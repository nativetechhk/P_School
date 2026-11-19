// GET /api/jobs/:id → 輪詢 fallback（SSE 不穩時，§8）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { queuePosition } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ ok: false, error: '搵唔到' }, { status: 404 });
  if (student && job.studentId !== student.id) return unauthorized();

  return NextResponse.json({
    ok: true,
    status: job.status,
    position: job.status === 'queued' ? await queuePosition(job.id) : 0,
    artifactIds: job.resultArtifactIds ?? [],
    error: job.error,
  });
}
