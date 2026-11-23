// POST /api/admin/export/final-works {classId} → 全班完成作 ZIP（§5.7）
// index.html 總目錄 + 每人資料夾（carousel.html 第 6 節輪播 + portfolio.pdf 作品集）
import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized } from '@/lib/session';
import { portfolioPdf } from '@/lib/export';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const classId = String(body.classId ?? '');
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  const students = await prisma.student.findMany({ where: { classId }, orderBy: { username: 'asc' } });
  if (!students.length) return NextResponse.json({ ok: false, error: '此班沒有學生' }, { status: 404 });

  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on('data', (c) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => { archive.on('end', () => resolve()); archive.on('error', reject); });

  const entries: { who: string; folder: string; hasCarousel: boolean; hasPdf: boolean }[] = [];
  for (const s of students) {
    const who = s.nickname || s.username;
    const folder = s.username;
    let hasCarousel = false, hasPdf = false;
    // 第 6 節輪播（取最新一個）
    const carousel = await prisma.artifact.findFirst({
      where: { studentId: s.id, role: 'carousel', status: 'ok' }, orderBy: { createdAt: 'desc' },
    });
    if (carousel) {
      const html = await storage.read(carousel.filePath).catch(() => null);
      if (html) { archive.append(html, { name: `${folder}/carousel.html` }); hasCarousel = true; }
    }
    // 作品集 PDF（§5.7 仍保留）
    try {
      const pdf = await portfolioPdf(s.id);
      archive.append(pdf, { name: `${folder}/portfolio.pdf` });
      hasPdf = true;
    } catch { /* 無作品則跳過 */ }
    if (hasCarousel || hasPdf) entries.push({ who, folder, hasCarousel, hasPdf });
  }

  // 總目錄 index.html
  const links = entries.map((e) => `<li><b>${e.who}</b>（${e.folder}）：
    ${e.hasCarousel ? `<a href="./${e.folder}/carousel.html">🎠 輪播</a>` : ''}
    ${e.hasPdf ? `<a href="./${e.folder}/portfolio.pdf">📘 作品集 PDF</a>` : ''}</li>`).join('');
  const index = `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"><title>${cls?.name ?? ''} 完成作</title>
    <style>body{font-family:"PingFang TC","Noto Sans TC",sans-serif;max-width:800px;margin:40px auto;padding:0 20px;}
    h1{color:#c2185b} li{font-size:20px;margin:12px 0;line-height:1.8} a{margin-right:14px}</style></head>
    <body><h1>🎨 ${cls?.name ?? ''} — 全班完成作</h1><ol>${links}</ol></body></html>`;
  archive.append(Buffer.from(index, 'utf8'), { name: 'index.html' });

  await archive.finalize();
  await done;
  const zip = Buffer.concat(chunks);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="final-works-${classId}.zip"` },
  });
}
