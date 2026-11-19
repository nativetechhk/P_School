import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, forbidden } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const all = await prisma.promptTemplate.findMany();
  return new NextResponse(JSON.stringify({ _exportedAt: new Date().toISOString(), templates: all }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="prompt-templates.json"' },
  });
}
