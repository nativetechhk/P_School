import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized, forbidden } from '@/lib/session';
import { audit } from '@/lib/audit';
import { storage } from '@/lib/storage';
import { LESSONS } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const classes = await prisma.class.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { students: true } } },
  });
  return NextResponse.json({ ok: true, classes });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const group = body.group === 'junior' ? 'junior' : 'senior';
  if (!name) return NextResponse.json({ ok: false, error: '請輸入班名' }, { status: 400 });

  const cls = await prisma.class.create({ data: { name, group, note: body.note ? String(body.note) : null } });
  // 自動為該組所有課堂建立 lesson_access（預設關閉）
  await prisma.lessonAccess.createMany({
    data: LESSONS.filter((l) => l.group === group).map((l) => ({
      classId: cls.id, lessonId: l.id, enabled: false, quotaPerStudent: l.defaultQuota || 10,
    })),
    skipDuplicates: true,
  });
  await audit(staff.username!, 'create_class', cls.id);
  return NextResponse.json({ ok: true, class: cls });
}

export async function DELETE(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: '缺少 id' }, { status: 400 });
  // artifacts/jobs/quota 無 FK cascade，需手動清理（連同磁碟檔案），避免孤兒資料
  const artifacts = await prisma.artifact.findMany({ where: { classId: id }, select: { filePath: true, thumbPath: true } });
  for (const a of artifacts) {
    await storage.remove(a.filePath);
    if (a.thumbPath) await storage.remove(a.thumbPath);
  }
  const studentIds = (await prisma.student.findMany({ where: { classId: id }, select: { id: true } })).map((s) => s.id);
  await prisma.$transaction([
    prisma.artifact.deleteMany({ where: { classId: id } }),
    prisma.job.deleteMany({ where: { classId: id } }),
    ...(studentIds.length ? [
      prisma.quotaUsage.deleteMany({ where: { studentId: { in: studentIds } } }),
      prisma.dailyUsage.deleteMany({ where: { studentId: { in: studentIds } } }),
    ] : []),
    prisma.class.delete({ where: { id } }), // students cascade via FK
  ]);
  await audit(staff.username!, 'delete_class', id);
  return NextResponse.json({ ok: true });
}
