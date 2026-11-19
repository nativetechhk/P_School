// 課堂開關與配額（§3.2）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized, forbidden } from '@/lib/session';
import { audit } from '@/lib/audit';
import { LESSONS } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const classId = req.nextUrl.searchParams.get('classId');
  if (!classId) return NextResponse.json({ ok: false, error: '缺少 classId' }, { status: 400 });
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return NextResponse.json({ ok: false, error: '班別不存在' }, { status: 404 });

  const rows = await prisma.lessonAccess.findMany({ where: { classId } });
  const map = new Map(rows.map((r) => [r.lessonId, r]));
  const lessons = LESSONS.filter((l) => l.group === cls.group).map((l) => {
    const a = map.get(l.id);
    return {
      lessonId: l.id, title: l.title, lessonNo: l.lessonNo,
      enabled: a?.enabled ?? false,
      quotaPerStudent: a?.quotaPerStudent ?? l.defaultQuota ?? 10,
      cooldownSeconds: a?.cooldownSeconds ?? 60,
    };
  });
  return NextResponse.json({ ok: true, group: cls.group, lessons });
}

export async function PUT(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const { classId, lessonId } = body;
  if (!classId || !lessonId) return NextResponse.json({ ok: false, error: '缺少參數' }, { status: 400 });

  const existing = await prisma.lessonAccess.findUnique({ where: { classId_lessonId: { classId, lessonId } } });
  const enabled = body.enabled ?? existing?.enabled ?? false;
  const row = await prisma.lessonAccess.upsert({
    where: { classId_lessonId: { classId, lessonId } },
    update: {
      enabled,
      quotaPerStudent: body.quotaPerStudent ?? existing?.quotaPerStudent ?? 10,
      cooldownSeconds: body.cooldownSeconds ?? existing?.cooldownSeconds ?? 60,
      openedAt: enabled && !existing?.openedAt ? new Date() : existing?.openedAt,
      closedAt: !enabled ? new Date() : null,
    },
    create: {
      classId, lessonId, enabled,
      quotaPerStudent: body.quotaPerStudent ?? 10, cooldownSeconds: body.cooldownSeconds ?? 60,
      openedAt: enabled ? new Date() : null,
    },
  });
  await audit(staff.username!, enabled ? 'open_lesson' : 'close_lesson', `${classId}:${lessonId}`);
  return NextResponse.json({ ok: true, access: row });
}
