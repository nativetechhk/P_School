import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized } from '@/lib/session';

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
  const rows = [['username', 'password', 'class', 'group', 'active']];
  for (const s of students) rows.push([s.username, s.initialPassword ?? '(已改)', s.class.name, s.group, String(s.active)]);
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="accounts.csv"' },
  });
}
