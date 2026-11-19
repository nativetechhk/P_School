// POST /api/admin/prompts/preview {lessonId, slots, freeText} → 顯示最終 prompt（§4.3 即時預覽）
import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, forbidden } from '@/lib/session';
import { assemblePrompt } from '@/lib/prompt-engine';

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  try {
    const assembled = await assemblePrompt({
      lessonId: String(body.lessonId ?? ''),
      slots: body.slots ?? {},
      freeTexts: body.freeTexts,
      freeText: body.freeText,
      charName: body.charName,
    });
    return NextResponse.json({ ok: true, ...assembled });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message) }, { status: 400 });
  }
}
