// POST /api/speech/match {transcript, setName} → {ids[]}（§4.2 語音近似選項）
import { NextRequest, NextResponse } from 'next/server';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { getOptionSet } from '@/lib/prompt-engine';
import { matchVoiceToOptions } from '@/lib/gemini';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const transcript = String(body.transcript ?? '').slice(0, 100);
  const setName = String(body.setName ?? '');
  if (!transcript || !setName) return NextResponse.json({ ok: false, error: '缺少參數' }, { status: 400 });

  const options = (await getOptionSet(setName, student?.group)).map((o) => ({ id: o.itemId!, label: o.labelZh ?? '' }));
  const settings = await getSettings();
  const voiceHints = await prisma.setting.findFirst({ where: { key: 'voice_hints' } });
  const matchTemplate = (voiceHints?.value as { matchTemplate?: string })?.matchTemplate
    ?? '學生說了「{TRANSCRIPT}」。選項：\n{OPTIONS}\n回傳最接近的 3 個 id JSON 陣列。';

  const ids = await matchVoiceToOptions(transcript, options, matchTemplate, settings.textModel);
  return NextResponse.json({ ok: true, ids, transcript });
}
