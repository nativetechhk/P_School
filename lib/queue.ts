// BullMQ 佇列（§6.2）。web 端只 enqueue；worker 容器消費。
import { Queue } from 'bullmq';
import { redis } from './redis';
import { prisma } from './db';

export const GENERATE_QUEUE = 'aiclass-generate';

const globalForQueue = globalThis as unknown as { genQueue?: Queue };

export function genQueue(): Queue {
  if (!globalForQueue.genQueue) {
    globalForQueue.genQueue = new Queue(GENERATE_QUEUE, { connection: redis });
  }
  return globalForQueue.genQueue;
}

export interface GenerateJobData {
  dbJobId: string;
  kind: 'generate' | 'edit' | 'demo';
  studentId: string; // demo 模式為 staff id
  isStaffDemo?: boolean;
  classId: string;
  lessonId: string;
  promptSent: string;
  promptZh: string;
  aspect: string;
  templateVersion: number;
  role: string; // character | scene_1 | styled | ...
  imagesCount: number; // 每次生成張數（預設 2；edit 為 1）
  sourceArtifactId?: string; // edit 模式
  flagged?: boolean; // 黑名單「只標記」命中
  params?: Record<string, unknown>;
}

export async function enqueueGeneration(data: GenerateJobData) {
  await genQueue().add('generate', data, { jobId: data.dbJobId, removeOnComplete: 500, removeOnFail: 500 });
}

/** 排隊位置：以 DB queued jobs 計 */
export async function queuePosition(dbJobId: string): Promise<number> {
  const job = await prisma.job.findUnique({ where: { id: dbJobId } });
  if (!job || job.status !== 'queued') return 0;
  return prisma.job.count({ where: { status: 'queued', createdAt: { lt: job.createdAt } } }) as Promise<number>;
}
