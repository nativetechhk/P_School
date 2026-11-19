// GET /api/artifacts?lessonId=&role= → 本人作品（供承接面板／我的作品）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { signPath } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const lessonId = sp.get('lessonId') ?? undefined;
  const role = sp.get('role') ?? undefined;
  const roles = sp.get('roles')?.split(',').filter(Boolean);

  const artifacts = await prisma.artifact.findMany({
    where: {
      studentId: student ? student.id! : (sp.get('studentId') ?? '__none__'),
      status: 'ok',
      ...(lessonId ? { lessonId } : {}),
      ...(role ? { role } : {}),
      ...(roles?.length ? { role: { in: roles } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    ok: true,
    artifacts: artifacts.map((a) => ({
      id: a.id, lessonId: a.lessonId, role: a.role, type: a.type,
      promptZh: a.promptZh, favorite: a.favorite, teacherHeart: a.teacherHeart,
      teacherNote: a.teacherNote, createdAt: a.createdAt,
      url: signPath(a.filePath, 7200),
      thumbUrl: a.thumbPath ? signPath(a.thumbPath, 7200) : null,
      params: a.params,
    })),
  });
}

// PATCH /api/artifacts  {id, favorite} → 標記最喜歡
export async function PATCH(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const artifact = await prisma.artifact.findUnique({ where: { id: String(body.id ?? '') } });
  if (!artifact || artifact.studentId !== student.id) return unauthorized('搵唔到作品');
  await prisma.artifact.update({ where: { id: artifact.id }, data: { favorite: !!body.favorite } });
  return NextResponse.json({ ok: true });
}
