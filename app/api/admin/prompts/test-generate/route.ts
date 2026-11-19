// POST /api/admin/prompts/test-generate → 用 admin 配額即時試生成（§4.3）
import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, forbidden } from '@/lib/session';
import { assemblePrompt } from '@/lib/prompt-engine';
import { generateImage } from '@/lib/gemini';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  try {
    const assembled = await assemblePrompt({
      lessonId: String(body.lessonId ?? ''), slots: body.slots ?? {},
      freeTexts: body.freeTexts, freeText: body.freeText, charName: body.charName,
    });
    const settings = await getSettings();
    const png = await generateImage({ model: settings.imageModel, prompt: assembled.promptSent, aspect: assembled.aspect });
    return NextResponse.json({
      ok: true, promptSent: assembled.promptSent,
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message) }, { status: 400 });
  }
}
