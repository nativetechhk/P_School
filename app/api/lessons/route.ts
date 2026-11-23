// GET /api/lessons → 可見課堂（含 v2.4 兩步／五色／輪播配置）+ 配額 + 所有選項卡（含畫家代表作、色票）
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, requireStaff, unauthorized } from '@/lib/session';
import { LESSONS } from '@/lib/config';
import { getQuotaState } from '@/lib/quota';
import { getLessonTemplate, getOptionSet } from '@/lib/prompt-engine';

export const dynamic = 'force-dynamic';

const ALL_SETS = [
  'styles', 'masters', 'subjects_senior', 'environments', 'scene_themes',
  'details_lighting', 'tones_three_acts', 'pets_junior', 'pet_colors_junior', 'colors14',
];

export async function GET() {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return unauthorized();

  const group = student?.group ?? 'senior';
  const defs = LESSONS.filter((l) => (staff ? true : l.group === group));

  // 一次過解析所有選項卡（畫家含 famousWorks/en/deathYear/blurb；色票含 hex）
  const optionSetsResolved: Record<string, unknown[]> = {};
  for (const setName of ALL_SETS) {
    const rows = await getOptionSet(setName, staff ? undefined : student?.group);
    optionSetsResolved[setName] = rows.map((o) => {
      const d = (o.data ?? {}) as { blurb?: string; en?: string; deathYear?: number | null; famousWorks?: unknown; hex?: string };
      return {
        id: o.itemId, icon: o.icon, labelZh: o.labelZh,
        blurb: d.blurb ?? null, en: d.en ?? null, deathYear: d.deathYear ?? null,
        famousWorks: d.famousWorks ?? null, hex: d.hex ?? null,
      };
    });
  }

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

    result.push({
      id: def.id, group: def.group, lessonNo: def.lessonNo, title: def.title,
      kind: def.kind, aspect: def.aspect, consumes: def.consumes, produces: def.produces,
      enabled,
      templateEnabled: !!template?.enabled,
      data: tdata, // 完整配置：slots/slotLabels/optionSets/actSlots/step1/step2/generate/edit/fiveColorMode/minWorks/orderHint/textTasks
      quota,
    });
  }
  return NextResponse.json({ ok: true, lessons: result, optionSets: optionSetsResolved, group, isStaff: !!staff });
}
