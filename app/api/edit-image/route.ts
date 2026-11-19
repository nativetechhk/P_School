// POST /api/edit-image {lessonId, sourceArtifactId, styleId} → {jobId}（圖生圖，senior-l5 / junior-l4）
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { getQuotaState, consumeQuota, checkGlobalDailyCap } from '@/lib/quota';
import { getLessonTemplate, getGlobalTemplate } from '@/lib/prompt-engine';
import { enqueueGeneration } from '@/lib/queue';
import { lessonById } from '@/lib/config';

const Body = z.object({
  lessonId: z.string(),
  sourceArtifactId: z.string(),
  styleId: z.string(),
});

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: '參數錯誤' }, { status: 400 });
  const { lessonId, sourceArtifactId, styleId } = parsed.data;
  const def = lessonById(lessonId);
  if (!def || def.kind !== 'edit') return NextResponse.json({ ok: false, error: '課堂不支援風格轉換' }, { status: 400 });

  const source = await prisma.artifact.findUnique({ where: { id: sourceArtifactId } });
  if (!source) return NextResponse.json({ ok: false, error: '搵唔到來源圖' }, { status: 404 });
  if (student && source.studentId !== student.id) return unauthorized('唔係你嘅作品');

  const isDemo = !!staff;
  const classId = student?.classId ?? source.classId;
  if (!isDemo) {
    const quota = await getQuotaState(student!.id!, classId, lessonId);
    if (!quota.canGenerate) return NextResponse.json({ ok: false, error: quota.reason }, { status: 429 });
    if (!(await checkGlobalDailyCap())) return NextResponse.json({ ok: false, error: '今日全校生成已達上限' }, { status: 429 });
  }

  const template = await getLessonTemplate(lessonId);
  if (!template?.enabled) return NextResponse.json({ ok: false, error: '導師未開放生成' }, { status: 403 });
  const setName = ((template.data as { optionSets?: Record<string, string> })?.optionSets?.STYLE) ?? 'masters';
  const style = await prisma.promptTemplate.findFirst({ where: { level: 'option', setName, itemId: styleId, enabled: true } });
  if (!style) return NextResponse.json({ ok: false, error: '風格選項不存在' }, { status: 404 });

  const g = await getGlobalTemplate();
  const promptSent = [
    g.prefix,
    (template.promptZh ?? '').replaceAll('{STYLE}', style.promptZh ?? style.labelZh ?? '').replaceAll('{STYLE_BOOST}', style.boostEn ?? ''),
    g.suffix,
  ].filter(Boolean).join(' ');
  const promptZh = `以${style.labelZh}風格重畫`;

  if (!isDemo) await consumeQuota(student!.id!, lessonId);

  const subjectId = isDemo ? staff!.id! : student!.id!;
  const job = await prisma.job.create({
    data: { studentId: subjectId, classId, lessonId, kind: 'edit', status: 'queued',
      payload: { sourceArtifactId, styleId, isDemo } as object },
  });

  await enqueueGeneration({
    dbJobId: job.id, kind: 'edit', studentId: subjectId, isStaffDemo: isDemo,
    classId, lessonId, promptSent, promptZh, aspect: 'keep',
    templateVersion: template.version, role: def.produces[0], imagesCount: 1,
    sourceArtifactId, params: { styleId, styleLabel: style.labelZh, sourceRole: source.role },
  });

  return NextResponse.json({ ok: true, jobId: job.id });
}
