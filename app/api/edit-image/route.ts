// POST /api/edit-image {lessonId, sourceArtifactId, styleId?|palette?, step?, role?} → {jobId}
// 圖生圖：senior-l5（畫家風格）、junior-l4 step2（畫家風格）、junior-l5 五色重畫（palette）
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { getQuotaState, consumeQuota, checkGlobalDailyCap } from '@/lib/quota';
import { assemblePrompt } from '@/lib/prompt-engine';
import { enqueueGeneration } from '@/lib/queue';
import { lessonById } from '@/lib/config';

const Palette = z.array(z.object({ zh: z.string(), hex: z.string() })).max(5).optional();
const Body = z.object({
  lessonId: z.string(),
  sourceArtifactId: z.string(),
  styleId: z.string().optional(),
  palette: Palette,
  step: z.enum(['step2', 'edit']).optional(),
  role: z.string().optional(),
});

const EDIT_KINDS = ['edit', 'two_step', 'five_color'];

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: '參數錯誤' }, { status: 400 });
  const { lessonId, sourceArtifactId, styleId, palette, step, role } = parsed.data;
  const def = lessonById(lessonId);
  if (!def || !EDIT_KINDS.includes(def.kind)) return NextResponse.json({ ok: false, error: '課堂不支援二次創作' }, { status: 400 });
  if (!styleId && !palette?.length) return NextResponse.json({ ok: false, error: '請揀畫家或 5 種顏色' }, { status: 400 });

  const source = await prisma.artifact.findUnique({ where: { id: sourceArtifactId } });
  if (!source) return NextResponse.json({ ok: false, error: '搵唔到來源圖' }, { status: 404 });
  if (student && source.studentId !== student.id) return unauthorized('唔係你嘅作品');

  const isDemo = !!staff;
  const classId = student?.classId ?? source.classId;
  if (!isDemo) {
    const quota = await getQuotaState(student!.id!, classId, lessonId);
    if (!quota.canGenerate) {
      const status = quota.reason === '本節未開放' ? 403 : 429;
      return NextResponse.json({ ok: false, error: quota.reason }, { status });
    }
    if (!(await checkGlobalDailyCap())) return NextResponse.json({ ok: false, error: '今日全校生成已達上限' }, { status: 429 });
  }

  let assembled;
  try {
    assembled = await assemblePrompt({
      lessonId,
      slots: styleId ? { STYLE: styleId } : {},
      step: step ?? (def.kind === 'two_step' ? 'step2' : def.kind === 'five_color' ? 'edit' : undefined),
      palette,
    });
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes('DISABLED')) return NextResponse.json({ ok: false, error: '導師未開放生成' }, { status: 403 });
    if (msg.includes('OPTION_NOT_FOUND')) return NextResponse.json({ ok: false, error: '選項不存在' }, { status: 404 });
    return NextResponse.json({ ok: false, error: '組裝 prompt 失敗' }, { status: 400 });
  }

  const outRole = role ?? (def.kind === 'two_step' ? 'styled_pet' : def.produces[0]);
  const promptZh = palette?.length ? `五色重畫（${palette.map((c) => c.zh).join('、')}）` : assembled.promptZh || '風格重畫';

  if (!isDemo) await consumeQuota(student!.id!, lessonId);

  const subjectId = isDemo ? staff!.id! : student!.id!;
  const job = await prisma.job.create({
    data: { studentId: subjectId, classId, lessonId, kind: 'edit', status: 'queued',
      payload: { sourceArtifactId, styleId, isDemo } as object },
  });

  await enqueueGeneration({
    dbJobId: job.id, kind: 'edit', studentId: subjectId, isStaffDemo: isDemo,
    classId, lessonId, promptSent: assembled.promptSent, promptZh, aspect: 'keep',
    templateVersion: assembled.templateVersion, role: outRole, imagesCount: 1,
    sourceArtifactId,
    params: { styleId, sourceRole: source.role, ...(palette?.length ? { palette } : {}) },
    palette: palette?.length ? palette : undefined,
    countColors: !!palette?.length,
  });

  return NextResponse.json({ ok: true, jobId: job.id });
}
