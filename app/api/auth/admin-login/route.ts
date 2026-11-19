import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession, STAFF_TTL } from '@/lib/session';
import { audit } from '@/lib/audit';

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: '請輸入電郵與密碼' }, { status: 400 });
  const { email, password } = parsed.data;

  const staff = await prisma.staff.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
    return NextResponse.json({ ok: false, error: '電郵或密碼錯誤' }, { status: 401 });
  }

  const session = await getSession(STAFF_TTL);
  session.kind = 'staff';
  session.id = staff.id;
  session.role = staff.role as 'admin' | 'assistant';
  session.username = staff.email;
  await session.save();
  await audit(staff.email, 'login');
  return NextResponse.json({ ok: true, role: staff.role });
}
