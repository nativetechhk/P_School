// 匯入／匯出 prompt 模板 JSON（§4.3）
import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, forbidden } from '@/lib/session';
import { importPromptSeed } from '@/lib/prompt-seed';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => null);
  if (!body?.seed) return NextResponse.json({ ok: false, error: '缺少 seed JSON' }, { status: 400 });
  const count = await importPromptSeed(body.seed, { overwrite: !!body.overwrite });
  await audit(staff.username!, 'import_prompts', String(count));
  return NextResponse.json({ ok: true, count });
}
