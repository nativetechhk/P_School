// POST /api/admin/data/bulk-delete（§3.6 兩步確認 + 輸入班名）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, forbidden } from '@/lib/session';
import { storage } from '@/lib/storage';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const { classId, target, confirmName } = body;
  const cls = await prisma.class.findUnique({ where: { id: String(classId ?? '') } });
  if (!cls) return NextResponse.json({ ok: false, error: '班別不存在' }, { status: 404 });
  if (confirmName !== cls.name) return NextResponse.json({ ok: false, error: '班名確認不符' }, { status: 400 });

  const where: Record<string, unknown> = { classId };
  if (body.lessonId) where.lessonId = body.lessonId;
  if (body.from || body.to) {
    where.createdAt = {};
    if (body.from) (where.createdAt as Record<string, Date>).gte = new Date(body.from);
    if (body.to) (where.createdAt as Record<string, Date>).lte = new Date(body.to);
  }

  if (target === 'artifacts') {
    const artifacts = await prisma.artifact.findMany({ where });
    for (const a of artifacts) {
      await storage.remove(a.filePath);
      if (a.thumbPath) await storage.remove(a.thumbPath);
    }
    const { count } = await prisma.artifact.deleteMany({ where });
    await audit(staff.username!, 'bulk_delete_artifacts', `${classId}:${count}`);
    return NextResponse.json({ ok: true, deleted: count });
  }
  if (target === 'accounts') {
    const students = await prisma.student.findMany({ where: { classId } });
    for (const s of students) await prisma.artifact.deleteMany({ where: { studentId: s.id } });
    const { count } = await prisma.student.deleteMany({ where: { classId } });
    await audit(staff.username!, 'bulk_delete_accounts', `${classId}:${count}`);
    return NextResponse.json({ ok: true, deleted: count });
  }
  return NextResponse.json({ ok: false, error: '未知目標' }, { status: 400 });
}
