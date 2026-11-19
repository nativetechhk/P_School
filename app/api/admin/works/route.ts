// 作品牆（§3.4）+ 隱藏／刪除／❤／評語
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized } from '@/lib/session';
import { storage, signPath } from '@/lib/storage';
import { publishEvent } from '@/lib/events';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const where: Record<string, unknown> = { type: 'image' };
  if (sp.get('classId')) where.classId = sp.get('classId');
  if (sp.get('lessonId')) where.lessonId = sp.get('lessonId');
  if (sp.get('studentId')) where.studentId = sp.get('studentId');
  if (sp.get('status')) where.status = sp.get('status');
  else where.status = { not: 'deleted' };

  const artifacts = await prisma.artifact.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
  const studentIds = Array.from(new Set(artifacts.map((a) => a.studentId)));
  const students = await prisma.student.findMany({ where: { id: { in: studentIds } } });
  const nameMap = new Map(students.map((s) => [s.id, s.nickname || s.username]));

  return NextResponse.json({
    ok: true,
    artifacts: artifacts.map((a) => ({
      id: a.id, studentId: a.studentId, who: nameMap.get(a.studentId) ?? a.studentId,
      lessonId: a.lessonId, role: a.role, promptZh: a.promptZh, status: a.status,
      teacherHeart: a.teacherHeart, teacherNote: a.teacherNote, createdAt: a.createdAt,
      thumbUrl: a.thumbPath ? signPath(a.thumbPath, 7200) : null,
      url: signPath(a.filePath, 7200),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '');
  const artifact = await prisma.artifact.findUnique({ where: { id } });
  if (!artifact) return NextResponse.json({ ok: false, error: '搵唔到' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.status === 'string') data.status = body.status;
  if (typeof body.teacherHeart === 'number') data.teacherHeart = body.teacherHeart;
  if (typeof body.teacherNote === 'string') data.teacherNote = body.teacherNote;
  const updated = await prisma.artifact.update({ where: { id }, data });

  if (data.status === 'hidden' || data.status === 'deleted') {
    await publishEvent({ type: 'artifact_hidden', classId: artifact.classId, artifactId: id });
    await audit(staff.username!, data.status === 'deleted' ? 'delete_work' : 'hide_work', id);
    if (data.status === 'deleted') {
      await storage.remove(artifact.filePath);
      if (artifact.thumbPath) await storage.remove(artifact.thumbPath);
    }
  }
  if (typeof body.teacherHeart === 'number') {
    await publishEvent({ type: 'artifact_heart', classId: artifact.classId, artifactId: id, hearts: body.teacherHeart });
  }
  return NextResponse.json({ ok: true, artifact: { id: updated.id, status: updated.status, teacherHeart: updated.teacherHeart } });
}
