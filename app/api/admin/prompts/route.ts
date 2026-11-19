// Prompt Engine 後台（§4.3）：樹狀列表 + 編輯（存版本記錄，改完即時生效）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized, forbidden } from '@/lib/session';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const all = await prisma.promptTemplate.findMany({ orderBy: [{ level: 'asc' }, { setName: 'asc' }, { sortOrder: 'asc' }] });
  return NextResponse.json({
    ok: true,
    global: all.filter((t) => t.level === 'global'),
    lessons: all.filter((t) => t.level === 'lesson'),
    options: all.filter((t) => t.level === 'option'),
  });
}

export async function PUT(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '');
  const existing = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, error: '搵唔到模板' }, { status: 404 });

  // 存快照（保留前 20 版）
  await prisma.promptTemplateHistory.create({ data: { templateId: id, snapshot: existing as object, savedBy: staff.username! } });
  const history = await prisma.promptTemplateHistory.findMany({ where: { templateId: id }, orderBy: { savedAt: 'desc' }, skip: 20 });
  if (history.length) await prisma.promptTemplateHistory.deleteMany({ where: { id: { in: history.map((h) => h.id) } } });

  const data: Record<string, unknown> = { version: existing.version + 1 };
  for (const f of ['labelZh', 'promptZh', 'boostEn', 'icon', 'group', 'enabled', 'sortOrder', 'data'] as const) {
    if (f in body) data[f] = body[f];
  }
  const updated = await prisma.promptTemplate.update({ where: { id }, data });
  await audit(staff.username!, 'edit_prompt', id);
  return NextResponse.json({ ok: true, template: updated });
}
