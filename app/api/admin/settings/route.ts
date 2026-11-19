import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, unauthorized, forbidden } from '@/lib/session';
import { getSettings, setSetting } from '@/lib/settings';
import { DEFAULT_SETTINGS } from '@/lib/config';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  return NextResponse.json({ ok: true, settings: await getSettings() });
}

export async function PUT(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const allowed = Object.keys(DEFAULT_SETTINGS);
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) await setSetting(k, v);
  }
  await audit(staff.username!, 'update_settings');
  return NextResponse.json({ ok: true, settings: await getSettings() });
}
