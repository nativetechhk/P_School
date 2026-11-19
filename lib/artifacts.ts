// Artifact 儲存：原圖 + 縮圖 + DB 記錄 + SSE 通知
import sharp from 'sharp';
import { prisma } from './db';
import { storage } from './storage';
import { publishEvent } from './events';

export interface SaveArtifactArgs {
  studentId: string;
  classId: string;
  lessonId: string;
  role: string;
  type?: string;
  png: Buffer;
  promptZh?: string;
  promptSent?: string;
  templateVersion?: number;
  sourceArtifactIds?: string[];
  model?: string;
  params?: Record<string, unknown>;
  status?: string;
  notify?: boolean;
}

export async function saveImageArtifact(args: SaveArtifactArgs) {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const dir = `artifacts/${args.classId}/${args.lessonId}/${args.studentId}`;
  const filePath = `${dir}/${id}.png`;
  const thumbPath = `${dir}/${id}_thumb.webp`;

  await storage.save(filePath, args.png);
  const thumb = await sharp(args.png).resize(320, 320, { fit: 'inside' }).webp({ quality: 75 }).toBuffer();
  await storage.save(thumbPath, thumb);

  const artifact = await prisma.artifact.create({
    data: {
      studentId: args.studentId, classId: args.classId, lessonId: args.lessonId,
      role: args.role, type: args.type ?? 'image',
      promptZh: args.promptZh, promptSent: args.promptSent, templateVersion: args.templateVersion,
      sourceArtifactIds: args.sourceArtifactIds ?? [],
      model: args.model, params: (args.params ?? {}) as object,
      filePath, thumbPath, status: args.status ?? 'ok',
    },
  });

  if (args.notify !== false && artifact.status === 'ok') {
    await publishEvent({ type: 'artifact_new', classId: args.classId, lessonId: args.lessonId, artifactId: artifact.id });
  }
  return artifact;
}

export async function bumpUsage(date: string, field: 'images' | 'edits' | 'visionCalls', by: number, costUsd: number) {
  await prisma.usageDaily.upsert({
    where: { date },
    update: { [field]: { increment: by }, estCostUsd: { increment: costUsd } },
    create: { date, [field]: by, estCostUsd: costUsd },
  });
}
