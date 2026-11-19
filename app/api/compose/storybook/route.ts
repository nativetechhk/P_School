// POST /api/compose/storybook {title, pages[{artifactId?, heading?, text}], threeSentences?} → {artifactId}（senior-l6）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, unauthorized } from '@/lib/session';
import { composeStorybook, StorybookPage } from '@/lib/compose';
import { imageDataUri } from '@/lib/export';
import { storage } from '@/lib/storage';
import { setSetting } from '@/lib/settings';

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const pagesIn = Array.isArray(body.pages) ? body.pages : [];

  const pages: StorybookPage[] = [];
  const sourceIds: string[] = [];
  for (const p of pagesIn) {
    let image: string | undefined;
    if (p.artifactId) {
      const a = await prisma.artifact.findUnique({ where: { id: String(p.artifactId) } });
      if (a && a.studentId === student.id) {
        image = await imageDataUri(a.filePath).catch(() => undefined);
        sourceIds.push(a.id);
      }
    }
    pages.push({ image, heading: p.heading ? String(p.heading).slice(0, 30) : undefined, text: String(p.text ?? '').slice(0, 120) });
  }

  const pdf = await composeStorybook({ title: String(body.title ?? '').slice(0, 40), pages });
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const filePath = `artifacts/${student.classId}/senior-l6-storybook/${student.id}/${id}.pdf`;
  await storage.save(filePath, pdf);

  const artifact = await prisma.artifact.create({
    data: {
      studentId: student.id!, classId: student.classId!, lessonId: 'senior-l6-storybook',
      role: 'storybook', type: 'pdf', promptZh: String(body.title ?? '我的 AI 故事書'),
      sourceArtifactIds: sourceIds, filePath, status: 'ok',
      params: { pages: pages.map((p) => ({ heading: p.heading, text: p.text })) } as object,
    },
  });
  if (Array.isArray(body.threeSentences) && body.threeSentences.length) {
    await setSetting(`three_sentences:${student.id}`, body.threeSentences.map((s: unknown) => String(s).slice(0, 40)));
  }
  return NextResponse.json({ ok: true, artifactId: artifact.id });
}
