import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized, forbidden } from '@/lib/session';
import { bulkGenerate, resetPassword } from '@/lib/accounts';
import { storage } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const classId = req.nextUrl.searchParams.get('classId') ?? undefined;
  const students = await prisma.student.findMany({
    where: classId ? { classId } : {},
    orderBy: { username: 'asc' },
    include: { class: { select: { name: true } } },
  });
  return NextResponse.json({
    ok: true,
    students: students.map((s) => ({
      id: s.id, username: s.username, nickname: s.nickname, group: s.group,
      classId: s.classId, className: s.class.name, active: s.active,
      locked: !!(s.lockedUntil && s.lockedUntil > new Date()), initialPassword: s.initialPassword,
    })),
  });
}

// POST action: bulk-generate | reset | toggle | delete
export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  if (action === 'bulk-generate') {
    const created = await bulkGenerate(String(body.classId), String(body.prefix ?? 'S-'), Number(body.count ?? 1), Number(body.startAt ?? 1));
    await audit(staff.username!, 'bulk_generate', `${body.classId}:${created.length}`);
    return NextResponse.json({ ok: true, created });
  }
  if (action === 'reset') {
    const password = await resetPassword(String(body.studentId));
    await audit(staff.username!, 'reset_password', String(body.studentId));
    return NextResponse.json({ ok: true, password });
  }
  if (action === 'toggle') {
    const s = await prisma.student.update({ where: { id: String(body.studentId) }, data: { active: !!body.active } });
    return NextResponse.json({ ok: true, active: s.active });
  }
  if (action === 'unlock') {
    await prisma.student.update({ where: { id: String(body.studentId) }, data: { failedAttempts: 0, lockedUntil: null } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'move') {
    await prisma.student.update({ where: { id: String(body.studentId) }, data: { classId: String(body.classId) } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'delete') {
    const sid = String(body.studentId);
    const arts = await prisma.artifact.findMany({ where: { studentId: sid }, select: { filePath: true, thumbPath: true } });
    for (const a of arts) {
      await storage.remove(a.filePath);
      if (a.thumbPath) await storage.remove(a.thumbPath);
    }
    await prisma.$transaction([
      prisma.artifact.deleteMany({ where: { studentId: sid } }),
      prisma.job.deleteMany({ where: { studentId: sid } }),
      prisma.quotaUsage.deleteMany({ where: { studentId: sid } }),
      prisma.dailyUsage.deleteMany({ where: { studentId: sid } }),
      prisma.student.delete({ where: { id: sid } }),
    ]);
    await audit(staff.username!, 'delete_student', sid);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: '未知操作' }, { status: 400 });
}
