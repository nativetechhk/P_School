// POST /api/compose/card {sourceArtifactId, name, traits[]} → {artifactId}（senior-l3 設定卡）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, unauthorized } from '@/lib/session';
import { composeCharacterCard } from '@/lib/compose';
import { saveImageArtifact } from '@/lib/artifacts';

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const source = await prisma.artifact.findUnique({ where: { id: String(body.sourceArtifactId ?? '') } });
  if (!source || source.studentId !== student.id) return unauthorized('搵唔到主角圖');

  const png = await composeCharacterCard({
    imagePath: source.filePath,
    name: String(body.name ?? '').slice(0, 20),
    traits: (Array.isArray(body.traits) ? body.traits : []).map((t: unknown) => String(t).slice(0, 20)),
  });
  const artifact = await saveImageArtifact({
    studentId: student.id!, classId: source.classId, lessonId: 'senior-l3-character',
    role: 'character_card', png, promptZh: `設定卡：${body.name ?? ''}`,
    sourceArtifactIds: [source.id], params: { name: body.name, traits: body.traits },
  });
  return NextResponse.json({ ok: true, artifactId: artifact.id });
}
