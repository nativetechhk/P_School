// POST /api/compose/poster {originalId?, styledId?, coloringId?, name, sentences[]} → {artifactId}（junior-l6）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, unauthorized } from '@/lib/session';
import { composePoster } from '@/lib/compose';
import { saveImageArtifact } from '@/lib/artifacts';
import { setSetting } from '@/lib/settings';

async function ownPath(studentId: string, id?: string) {
  if (!id) return undefined;
  const a = await prisma.artifact.findUnique({ where: { id } });
  return a && a.studentId === studentId ? a.filePath : undefined;
}

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const sentences = (Array.isArray(body.sentences) ? body.sentences : []).map((s: unknown) => String(s).slice(0, 20));

  const png = await composePoster({
    originalPath: await ownPath(student.id!, body.originalId),
    styledPath: await ownPath(student.id!, body.styledId),
    coloringPath: await ownPath(student.id!, body.coloringId),
    name: String(body.name ?? '').slice(0, 20),
    sentences,
  });
  const artifact = await saveImageArtifact({
    studentId: student.id!, classId: student.classId!, lessonId: 'junior-l6-poster',
    role: 'poster', png, promptZh: '我的魔法寵物海報',
    sourceArtifactIds: [body.originalId, body.styledId, body.coloringId].filter(Boolean),
    params: { name: body.name, sentences },
  });
  // 三句話存起，供作品集末頁用（§5.5）
  if (sentences.length) await setSetting(`three_sentences:${student.id}`, sentences);
  return NextResponse.json({ ok: true, artifactId: artifact.id });
}
