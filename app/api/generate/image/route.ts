// POST /api/generate/image {lessonId, slots{a,b,c,d}, freeTexts?, freeText?, aspect?, role?} → {jobId}
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { getQuotaState, consumeQuota, checkGlobalDailyCap } from '@/lib/quota';
import { assemblePrompt } from '@/lib/prompt-engine';
import { checkStudentText } from '@/lib/safety';
import { enqueueGeneration } from '@/lib/queue';
import { getSettings } from '@/lib/settings';
import { lessonById } from '@/lib/config';

const Body = z.object({
  lessonId: z.string(),
  slots: z.record(z.string()).default({}),
  freeTexts: z.record(z.string()).optional(),
  freeText: z.string().max(40).optional(),
  role: z.string().optional(), // scene_1/2/3 等由前端指定
  charName: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: '參數錯誤' }, { status: 400 });
  const { lessonId, slots, freeTexts, freeText, role, charName } = parsed.data;
  const def = lessonById(lessonId);
  if (!def) return NextResponse.json({ ok: false, error: '課堂不存在' }, { status: 404 });

  // 安全檢查（§7）：自由字 + 語音字
  let flagged = false;
  const freeInputs = [freeText, ...Object.values(freeTexts ?? {})].filter(Boolean) as string[];
  for (const txt of freeInputs) {
    const safety = await checkStudentText(txt);
    if (!safety.ok) return NextResponse.json({ ok: false, error: safety.message, blocked: true }, { status: 422 });
    if (safety.action === 'flag') flagged = true;
  }

  const settings = await getSettings();
  const isDemo = !!staff; // 導師示範不計配額（§5.4）
  const classId = student?.classId ?? (req.nextUrl.searchParams.get('classId') || 'demo');

  if (!isDemo) {
    const quota = await getQuotaState(student!.id!, classId, lessonId);
    if (!quota.canGenerate) {
      // 課堂未開放 → 403；配額／冷卻／每日上限 → 429
      const status = quota.reason === '本節未開放' ? 403 : 429;
      return NextResponse.json({ ok: false, error: quota.reason }, { status });
    }
    if (!(await checkGlobalDailyCap())) return NextResponse.json({ ok: false, error: '今日全校生成已達上限' }, { status: 429 });
  }

  let assembled;
  try {
    assembled = await assemblePrompt({ lessonId, slots, freeTexts, freeText, charName });
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes('DISABLED')) return NextResponse.json({ ok: false, error: '導師未開放生成' }, { status: 403 });
    return NextResponse.json({ ok: false, error: '組裝 prompt 失敗' }, { status: 400 });
  }

  if (!isDemo) await consumeQuota(student!.id!, lessonId);

  const subjectId = isDemo ? staff!.id! : student!.id!;
  const job = await prisma.job.create({
    data: {
      studentId: subjectId, classId, lessonId, kind: 'generate', status: 'queued',
      payload: { role: role ?? def.produces[0], isDemo } as object,
    },
  });

  await enqueueGeneration({
    dbJobId: job.id, kind: 'generate', studentId: subjectId, isStaffDemo: isDemo,
    classId, lessonId, promptSent: assembled.promptSent, promptZh: assembled.promptZh,
    aspect: assembled.aspect, templateVersion: assembled.templateVersion,
    role: role ?? def.produces[0], imagesCount: settings.imagesPerGeneration,
    flagged,
  });

  return NextResponse.json({ ok: true, jobId: job.id, promptZh: assembled.promptZh });
}
