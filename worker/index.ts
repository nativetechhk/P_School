// BullMQ worker（§6.2）：生成／編輯，含 token bucket、退避重試、備用模型、SafeSearch 複檢
import { Worker, Job } from 'bullmq';
import 'dotenv/config';
import { newRedis } from '../lib/redis';
import { prisma } from '../lib/db';
import { GENERATE_QUEUE, GenerateJobData } from '../lib/queue';
import { generateImage } from '../lib/gemini';
import { storage } from '../lib/storage';
import { saveImageArtifact, bumpUsage } from '../lib/artifacts';
import { safeSearchCheck, analyzePalette } from '../lib/vision';
import { publishEvent } from '../lib/events';
import { refundQuota } from '../lib/quota';
import { getSettings } from '../lib/settings';
import { acquire } from '../lib/token-bucket';
import { hkToday } from '../lib/config';
import { isMockAi } from '../lib/ai-key';
import { startCron } from './cron';

const connection = newRedis();
const rpmConn = newRedis();

const BACKOFFS = [2000, 4000, 8000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|rate|quota|overload/i.test(msg);
}

/** 單張生成：token bucket → 呼叫 → 退避重試 → 備用模型 */
async function generateOne(data: GenerateJobData, model: string, fallbackModel: string, globalRpm: number, imagenRpm: number, ref?: { mimeType: string; data: string }): Promise<Buffer> {
  // 計 RPM 使用率（供 usage 頁顯示）
  rpmConn.incr(`rpm:${Math.floor(Date.now() / 60000)}`).then((n) => { if (n === 1) rpmConn.expire(`rpm:${Math.floor(Date.now() / 60000)}`, 90); });

  const bucket = model.startsWith('imagen') ? 'imagen' : 'gemini';
  const rpm = bucket === 'imagen' ? imagenRpm : globalRpm;
  const mock = await isMockAi();
  if (!mock && !(await acquire(connection, bucket, rpm))) {
    throw new Error('TOKEN_BUCKET_TIMEOUT');
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= BACKOFFS.length; attempt++) {
    try {
      return await generateImage({ model, prompt: data.promptSent, aspect: data.aspect, referenceImage: ref });
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === BACKOFFS.length) break;
      await sleep(BACKOFFS[attempt]);
    }
  }
  // 備用模型（僅文生圖，§6.3）
  if (!ref && fallbackModel && fallbackModel !== model) {
    if (!mock) await acquire(connection, 'imagen', imagenRpm);
    return generateImage({ model: fallbackModel, prompt: data.promptSent, aspect: data.aspect });
  }
  throw lastErr;
}

async function processJob(job: Job<GenerateJobData>) {
  const data = job.data;
  const settings = await getSettings();

  await prisma.job.update({ where: { id: data.dbJobId }, data: { status: 'active' } });
  await publishEvent({ type: 'job', jobId: data.dbJobId, status: 'active' });

  let ref: { mimeType: string; data: string } | undefined;
  const sourceIds: string[] = [];
  if (data.kind === 'edit' && data.sourceArtifactId) {
    const source = await prisma.artifact.findUnique({ where: { id: data.sourceArtifactId } });
    if (!source) throw new Error('SOURCE_NOT_FOUND');
    const buf = await storage.read(source.filePath);
    ref = { mimeType: 'image/png', data: buf.toString('base64') };
    sourceIds.push(source.id);
  }

  const n = Math.max(1, data.imagesCount);
  const artifactIds: string[] = [];
  const results = await Promise.allSettled(
    Array.from({ length: n }, () =>
      generateOne(data, settings.imageModel, settings.fallbackImageModel, settings.globalRpm, settings.imagenRpm, ref)
    )
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const png = r.value;
    // 輸出複檢（§7）
    const verdict = await safeSearchCheck(png).catch(() => ({ safe: true }));
    // 五色模式：數主色，標示「AI 偷加咗 N 色」（§5.1）
    let params = data.params ?? {};
    if (data.countColors && data.palette?.length) {
      const res = await analyzePalette(png, data.palette.map((c) => c.hex)).catch(() => ({ distinct: 0, overflow: 0 }));
      params = { ...params, colorCheck: res };
    }
    const artifact = await saveImageArtifact({
      studentId: data.studentId, classId: data.classId, lessonId: data.lessonId, role: data.role,
      png, promptZh: data.promptZh, promptSent: data.promptSent, templateVersion: data.templateVersion,
      sourceArtifactIds: sourceIds, model: settings.imageModel,
      params,
      status: !verdict.safe || data.flagged ? 'review' : 'ok',
      notify: !data.isStaffDemo,
    });
    artifactIds.push(artifact.id);
  }

  if (!artifactIds.length) throw new Error('ALL_IMAGES_FAILED');

  await bumpUsage(hkToday(), data.kind === 'edit' ? 'edits' : 'images', artifactIds.length, artifactIds.length * settings.costPerImageUsd);
  await prisma.job.update({
    where: { id: data.dbJobId },
    data: { status: 'done', resultArtifactIds: artifactIds, finishedAt: new Date() },
  });
  await publishEvent({ type: 'job', jobId: data.dbJobId, status: 'done', artifactIds });
  return { artifactIds };
}

const worker = new Worker<GenerateJobData>(
  GENERATE_QUEUE,
  async (job) => {
    try {
      return await processJob(job);
    } catch (err) {
      const data = job.data;
      const msg = String((err as Error)?.message ?? err);
      // 退回配額（§6.2）
      if (!data.isStaffDemo) await refundQuota(data.studentId, data.lessonId).catch(() => {});
      await prisma.job.update({
        where: { id: data.dbJobId },
        data: { status: 'failed', error: msg, finishedAt: new Date() },
      }).catch(() => {});
      await publishEvent({ type: 'job', jobId: data.dbJobId, status: 'failed', error: 'AI 太忙，等一陣再試' });
      throw err;
    }
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3) }
);

worker.on('ready', async () => console.log(`[worker] ready (mock=${await isMockAi()}, concurrency=${process.env.WORKER_CONCURRENCY ?? 3})`));
startCron();
worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));
worker.on('completed', (job) => console.log(`[worker] job ${job.id} done`));

process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
process.on('SIGINT', async () => { await worker.close(); process.exit(0); });
