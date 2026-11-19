// POST /api/admin/prompts/restore {templateId, historyId}（§4.3 版本還原）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, forbidden } from '@/lib/session';
import { audit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const templateId = req.nextUrl.searchParams.get('templateId');
  if (!templateId) return NextResponse.json({ ok: false, error: '缺少 templateId' }, { status: 400 });
  const history = await prisma.promptTemplateHistory.findMany({ where: { templateId }, orderBy: { savedAt: 'desc' } });
  return NextResponse.json({ ok: true, history });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const hist = await prisma.promptTemplateHistory.findUnique({ where: { id: String(body.historyId ?? '') } });
  if (!hist) return NextResponse.json({ ok: false, error: '搵唔到版本' }, { status: 404 });
  const snap = hist.snapshot as Record<string, unknown>;
  const current = await prisma.promptTemplate.findUnique({ where: { id: hist.templateId } });
  const updated = await prisma.promptTemplate.update({
    where: { id: hist.templateId },
    data: {
      labelZh: snap.labelZh as string, promptZh: snap.promptZh as string, boostEn: snap.boostEn as string,
      icon: snap.icon as string, group: snap.group as string, enabled: snap.enabled as boolean,
      sortOrder: snap.sortOrder as number, data: snap.data as object, version: (current?.version ?? 1) + 1,
    },
  });
  await audit(staff.username!, 'restore_prompt', hist.templateId);
  return NextResponse.json({ ok: true, template: updated });
}
