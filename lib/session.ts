import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export interface SessionData {
  kind?: 'student' | 'staff';
  id?: string;
  role?: 'admin' | 'assistant' | 'student';
  username?: string; // 學生帳號名或 staff email
  group?: 'junior' | 'senior';
  classId?: string;
}

const STUDENT_TTL = 8 * 3600;
const STAFF_TTL = 24 * 3600;

export function sessionOptions(ttl: number = STAFF_TTL): SessionOptions {
  return {
    password: process.env.SESSION_SECRET!,
    cookieName: 'aiclass_session',
    ttl,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
    },
  };
}

export async function getSession(ttl?: number): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions(ttl));
}

export async function requireStudent() {
  const session = await getSession(STUDENT_TTL);
  if (session.kind !== 'student' || !session.id) return null;
  return session;
}

export async function requireStaff(role?: 'admin') {
  const session = await getSession(STAFF_TTL);
  if (session.kind !== 'staff' || !session.id) return null;
  if (role === 'admin' && session.role !== 'admin') return null;
  return session;
}

export function unauthorized(msg = '請先登入') {
  return NextResponse.json({ ok: false, error: msg }, { status: 401 });
}

export function forbidden(msg = '無權限') {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export { STUDENT_TTL, STAFF_TTL };
