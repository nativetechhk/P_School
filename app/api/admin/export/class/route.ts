// POST /api/admin/export/class {classId, lessonIds[], format} → ZIP（§3.6 批量匯出）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized } from '@/lib/session';
import { artifactsToZip } from '@/lib/export';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const classId = String(body.classId ?? '');
  const lessonIds: string[] = Array.isArray(body.lessonIds) ? body.lessonIds : [];
  if (!classId) return NextResponse.json({ ok: false, error: '缺少 classId' }, { status: 400 });

  const artifacts = await prisma.artifact.findMany({
    where: { classId, status: 'ok', type: 'image', ...(lessonIds.length ? { lessonId: { in: lessonIds } } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  if (!artifacts.length) return NextResponse.json({ ok: false, error: '沒有作品可匯出' }, { status: 404 });

  const zip = await artifactsToZip(artifacts);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="class-${classId}.zip"` },
  });
}
