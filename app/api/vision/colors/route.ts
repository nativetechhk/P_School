// POST /api/vision/colors {artifactId} → {colors[5]}（junior-l5）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, unauthorized } from '@/lib/session';
import { storage } from '@/lib/storage';
import { dominantColors } from '@/lib/vision';
import { bumpUsage } from '@/lib/artifacts';
import { hkToday } from '@/lib/config';

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const artifact = await prisma.artifact.findUnique({ where: { id: String(body.artifactId ?? '') } });
  if (!artifact || artifact.studentId !== student.id) return unauthorized('搵唔到作品');

  const buf = await storage.read(artifact.filePath);
  const colors = await dominantColors(buf);
  await bumpUsage(hkToday(), 'visionCalls', 1, 0);

  // 存為 palette artifact
  const saved = await prisma.artifact.create({
    data: {
      studentId: student.id!, classId: artifact.classId, lessonId: 'junior-l5-palette',
      role: 'palette', type: 'json', promptZh: '5 色配方',
      sourceArtifactIds: [artifact.id], filePath: artifact.filePath, thumbPath: artifact.thumbPath,
      params: { colors } as object, status: 'ok',
    },
  });
  return NextResponse.json({ ok: true, colors, artifactId: saved.id });
}
