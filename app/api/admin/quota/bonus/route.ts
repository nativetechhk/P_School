// POST /api/admin/quota/bonus {studentId, lessonId, bonus}（§3.7 加配額）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, forbidden } from '@/lib/session';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const { studentId, lessonId } = body;
  const bonus = Number(body.bonus ?? 0);
  if (!studentId || !lessonId) return NextResponse.json({ ok: false, error: '缺少參數' }, { status: 400 });
  await prisma.quotaUsage.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    update: { bonus: { increment: bonus } },
    create: { studentId, lessonId, bonus },
  });
  await audit(staff.username!, 'quota_bonus', `${studentId}:${lessonId}:+${bonus}`);
  return NextResponse.json({ ok: true });
}
