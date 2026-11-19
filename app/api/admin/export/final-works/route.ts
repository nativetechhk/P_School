// POST /api/admin/export/final-works {classId} → 每位學生一份作品集 PDF 打包 ZIP（§3.6/§5.5）
import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized } from '@/lib/session';
import { portfolioPdf } from '@/lib/export';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const classId = String(body.classId ?? '');
  const students = await prisma.student.findMany({ where: { classId } });
  if (!students.length) return NextResponse.json({ ok: false, error: '此班沒有學生' }, { status: 404 });

  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on('data', (c) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => { archive.on('end', () => resolve()); archive.on('error', reject); });

  for (const s of students) {
    try {
      const pdf = await portfolioPdf(s.id);
      archive.append(pdf, { name: `${s.username}_作品集.pdf` });
    } catch { /* 跳過沒有作品的學生 */ }
  }
  await archive.finalize();
  await done;

  const zip = Buffer.concat(chunks);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="final-works-${classId}.zip"` },
  });
}
