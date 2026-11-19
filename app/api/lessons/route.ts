// GET /api/lessons → 可見課堂 + 配額 + 冷卻 +（每課堂）選項卡資料
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { LESSONS } from '@/lib/config';
import { getQuotaState } from '@/lib/quota';
import { getLessonTemplate, getOptionSet } from '@/lib/prompt-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const group = student?.group ?? 'senior';
  const defs = LESSONS.filter((l) => (staff ? true : l.group === group));

  const result = [];
  for (const def of defs) {
    let enabled = true;
    let quota = null;
    if (student) {
      const access = await prisma.lessonAccess.findUnique({
        where: { classId_lessonId: { classId: student.classId!, lessonId: def.id } },
      });
      enabled = !!access?.enabled;
      if (!enabled) continue; // 學生只見已開放課堂（§4.1）
      quota = await getQuotaState(student.id!, student.classId!, def.id);
    }

    const template = await getLessonTemplate(def.id);
    const tdata = (template?.data ?? {}) as Record<string, unknown>;
    const optionSets: Record<string, unknown[]> = {};
    const sets = (tdata.optionSets ?? {}) as Record<string, string>;
    for (const [slot, setName] of Object.entries(sets)) {
      optionSets[slot] = (await getOptionSet(setName, staff ? undefined : student?.group)).map((o) => ({
        id: o.itemId, icon: o.icon, labelZh: o.labelZh, blurb: (o.data as { blurb?: string } | null)?.blurb,
      }));
    }

    result.push({
      ...def,
      enabled,
      templateEnabled: !!template?.enabled,
      slotLabels: tdata.slotLabels ?? {},
      slots: tdata.slots ?? [],
      actSlots: tdata.actSlots ?? null,
      optionSets,
      optionSetsRaw: sets,
      textTasks: tdata.textTasks ?? null,
      quota,
    });
  }
  return NextResponse.json({ ok: true, lessons: result, group, isStaff: !!staff });
}
