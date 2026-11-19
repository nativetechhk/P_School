import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession, STUDENT_TTL } from '@/lib/session';

const Body = z.object({ username: z.string().min(1).max(32), password: z.string().min(1).max(32) });
const LOCK_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: '請輸入帳號同密碼' }, { status: 400 });
  const { username, password } = parsed.data;

  const student = await prisma.student.findUnique({ where: { username: username.trim() } });
  if (!student || !student.active) {
    return NextResponse.json({ ok: false, error: '帳號或密碼唔啱，再試下！' }, { status: 401 });
  }
  if (student.lockedUntil && student.lockedUntil > new Date()) {
    const mins = Math.ceil((student.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json({ ok: false, error: `試得太多次喇，${mins} 分鐘後再試` }, { status: 423 });
  }

  const match = await bcrypt.compare(password, student.passwordHash);
  if (!match) {
    const attempts = student.failedAttempts + 1;
    await prisma.student.update({
      where: { id: student.id },
      data: {
        failedAttempts: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    });
    return NextResponse.json({ ok: false, error: '帳號或密碼唔啱，再試下！' }, { status: 401 });
  }

  await prisma.student.update({ where: { id: student.id }, data: { failedAttempts: 0, lockedUntil: null } });
  const session = await getSession(STUDENT_TTL);
  session.kind = 'student';
  session.id = student.id;
  session.role = 'student';
  session.username = student.username;
  session.group = student.group as 'junior' | 'senior';
  session.classId = student.classId;
  await session.save();
  return NextResponse.json({ ok: true, group: student.group });
}
