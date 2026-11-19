// 列印派發卡 PDF（§3.1）：每張 A6，帳號／密碼／QR／網址
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized } from '@/lib/session';
import { htmlToPdf } from '@/lib/export';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const classId = req.nextUrl.searchParams.get('classId');
  if (!classId) return NextResponse.json({ ok: false, error: '缺少 classId' }, { status: 400 });

  const students = await prisma.student.findMany({ where: { classId }, orderBy: { username: 'asc' } });
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  let cards = '';
  for (const s of students) {
    const pw = s.initialPassword ?? '(已改，請重設)';
    // QR 內含帳密，掃描自動填入（§2）
    const payload = `${appUrl}/login?u=${encodeURIComponent(s.username)}&p=${encodeURIComponent(pw)}`;
    const qr = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
    cards += `<div class="card">
      <div class="brand">🎨 小小 AI 探索家</div>
      <div class="row"><span class="k">帳號</span><span class="v">${s.username}</span></div>
      <div class="row"><span class="k">密碼</span><span class="v">${pw}</span></div>
      <img class="qr" src="${qr}"/>
      <div class="url">${appUrl.replace(/^https?:\/\//, '')}</div>
      <div class="hint">👆 掃 QR 自動登入，或輸入帳號密碼</div>
    </div>`;
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A6; margin: 0; }
    body { margin: 0; font-family: "PingFang TC","Noto Sans TC",sans-serif; }
    .card { width: 105mm; height: 146mm; box-sizing: border-box; padding: 10mm; page-break-after: always; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
      background: linear-gradient(160deg,#fff3e0,#e1f5fe); }
    .card:last-child { page-break-after: auto; }
    .brand { font-size: 26px; font-weight: 800; color: #e65100; margin-bottom: 18px; }
    .row { display: flex; width: 100%; justify-content: center; gap: 12px; font-size: 30px; margin: 6px 0; }
    .k { color: #777; } .v { font-weight: 800; letter-spacing: 2px; }
    .qr { width: 60mm; height: 60mm; margin: 14px 0; }
    .url { font-size: 18px; color: #0277bd; } .hint { font-size: 16px; color: #888; margin-top: 10px; }
  </style></head><body>${cards || '<div class="card">此班未有帳號</div>'}</body></html>`;

  const pdf = await htmlToPdf(html, { format: 'A6' });
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="cards.pdf"' },
  });
}
