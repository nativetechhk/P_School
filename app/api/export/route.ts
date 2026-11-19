// POST /api/export {artifactIds[], format} → {url}（學生自助匯出，§4.4）
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStudent, unauthorized } from '@/lib/session';
import { storage, signPath } from '@/lib/storage';
import { artifactsToZip, artifactsToDocx } from '@/lib/export';

const Body = z.object({
  artifactIds: z.array(z.string()).min(1).max(100),
  format: z.enum(['png', 'zip', 'pdf', 'docx']),
});

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: '參數錯誤' }, { status: 400 });

  const artifacts = await prisma.artifact.findMany({
    where: { id: { in: parsed.data.artifactIds }, studentId: student.id!, status: 'ok' },
  });
  if (!artifacts.length) return NextResponse.json({ ok: false, error: '搵唔到作品' }, { status: 404 });

  // 單張 PNG 直接簽發
  if (parsed.data.format === 'png' && artifacts.length === 1) {
    return NextResponse.json({ ok: true, url: signPath(artifacts[0].filePath, 3600) + `&dl=${artifacts[0].role}.png` });
  }

  const stamp = Date.now().toString(36);
  const base = `exports/${student.id}/${stamp}`;
  let out: Buffer;
  let ext: string;
  if (parsed.data.format === 'docx') {
    out = await artifactsToDocx(artifacts, '我的作品');
    ext = 'docx';
  } else if (parsed.data.format === 'pdf') {
    const { portfolioPdf } = await import('@/lib/export');
    out = await portfolioPdf(student.id!);
    ext = 'pdf';
  } else {
    out = await artifactsToZip(artifacts);
    ext = 'zip';
  }
  const relPath = `${base}.${ext}`;
  await storage.save(relPath, out);
  return NextResponse.json({ ok: true, url: signPath(relPath, 3600) + `&dl=my-works.${ext}` });
}
