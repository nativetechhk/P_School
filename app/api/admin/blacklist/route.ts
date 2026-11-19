// 黑名單 CRUD + CSV 匯入（§3.4）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized, forbidden } from '@/lib/session';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const terms = await prisma.blacklist.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ ok: true, terms });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));

  if (Array.isArray(body.csv)) {
    // CSV 匯入：[{term, mode}]
    const data = body.csv
      .map((r: { term?: string; mode?: string }) => ({ term: String(r.term ?? '').trim(), mode: r.mode === 'flag' ? 'flag' : 'block', createdBy: staff.username! }))
      .filter((r: { term: string }) => r.term);
    await prisma.blacklist.createMany({ data });
    await audit(staff.username!, 'import_blacklist', String(data.length));
    return NextResponse.json({ ok: true, count: data.length });
  }

  const term = String(body.term ?? '').trim();
  if (!term) return NextResponse.json({ ok: false, error: '請輸入詞語' }, { status: 400 });
  const row = await prisma.blacklist.create({
    data: { term, mode: body.mode === 'flag' ? 'flag' : 'block', createdBy: staff.username! },
  });
  return NextResponse.json({ ok: true, term: row });
}

export async function DELETE(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: '缺少 id' }, { status: 400 });
  await prisma.blacklist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
