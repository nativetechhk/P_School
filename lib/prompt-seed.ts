// 匯入 prompt_templates.seed.json 到 DB（§4.3）
import { prisma } from './db';

interface SeedFile {
  global?: { prefix?: string; suffix?: string; negativeTerms?: string; humanBlockTerms?: string[]; enabled?: boolean };
  lessons?: Record<string, Record<string, unknown>>;
  voice_hints?: { matchTemplate?: string };
  [setName: string]: unknown;
}

const OPTION_SETS = [
  'styles', 'masters', 'subjects_senior',
  'environments', 'scene_themes', 'details_lighting', 'tones_three_acts',
  'pets_junior', 'pet_colors_junior', 'colors14',
];

export async function importPromptSeed(seed: SeedFile, opts: { overwrite?: boolean } = {}): Promise<number> {
  let count = 0;

  // global
  if (seed.global) {
    await prisma.promptTemplate.upsert({
      where: { level_lessonId_setName_itemId: { level: 'global', lessonId: '', setName: '', itemId: '' } },
      update: opts.overwrite ? { data: seed.global as object, enabled: seed.global.enabled ?? true } : {},
      create: { level: 'global', lessonId: '', setName: '', itemId: '', data: seed.global as object, enabled: seed.global.enabled ?? true },
    });
    count++;
  }

  // lessons
  for (const [lessonId, lesson] of Object.entries(seed.lessons ?? {})) {
    const { template, enabled, ...rest } = lesson as { template?: string; enabled?: boolean };
    await prisma.promptTemplate.upsert({
      where: { level_lessonId_setName_itemId: { level: 'lesson', lessonId, setName: '', itemId: '' } },
      update: opts.overwrite ? { promptZh: template ?? '', enabled: enabled ?? true, data: rest as object } : {},
      create: { level: 'lesson', lessonId, setName: '', itemId: '', promptZh: template ?? '', enabled: enabled ?? true, data: rest as object },
    });
    count++;
  }

  // option sets
  for (const setName of OPTION_SETS) {
    const set = seed[setName] as { items?: Array<Record<string, unknown>> } | undefined;
    if (!set?.items) continue;
    let order = 0;
    for (const item of set.items) {
      const itemId = String(item.id);
      // 保留選項卡的額外中繼資料（畫家代表作、逝世年、英文名、色票 hex 等）
      const extra = {
        blurb: item.blurb ?? null,
        en: item.en ?? null,
        deathYear: item.deathYear ?? null,
        famousWorks: item.famousWorks ?? null,
        hex: item.hex ?? null,
      };
      const fields = {
        labelZh: item.labelZh as string, promptZh: (item.promptZh as string) ?? null, boostEn: (item.boostEn as string) ?? null,
        icon: (item.icon as string) ?? null, group: (item.group as string) ?? 'both', enabled: (item.enabled as boolean) ?? true,
        sortOrder: order, data: extra as object,
      };
      await prisma.promptTemplate.upsert({
        where: { level_lessonId_setName_itemId: { level: 'option', lessonId: '', setName, itemId } },
        update: opts.overwrite ? fields : {},
        create: { level: 'option', lessonId: '', setName, itemId, ...fields },
      });
      order++;
      count++;
    }
  }

  // voice_hints 存 settings
  if (seed.voice_hints) {
    await prisma.setting.upsert({
      where: { key: 'voice_hints' }, update: { value: seed.voice_hints as object }, create: { key: 'voice_hints', value: seed.voice_hints as object },
    });
  }

  // 清走種子已移除的舊模板（例如 masters_junior、senior-l6-storybook），令後台乾淨
  if (opts.overwrite) {
    const validLessonIds = Object.keys(seed.lessons ?? {});
    await prisma.promptTemplate.deleteMany({ where: { level: 'lesson', lessonId: { notIn: validLessonIds } } });

    const validOptionKeys = new Set<string>();
    for (const setName of OPTION_SETS) {
      const set = seed[setName] as { items?: Array<Record<string, unknown>> } | undefined;
      for (const item of set?.items ?? []) validOptionKeys.add(`${setName}:${item.id}`);
    }
    const options = await prisma.promptTemplate.findMany({ where: { level: 'option' }, select: { id: true, setName: true, itemId: true } });
    const staleIds = options.filter((o) => !validOptionKeys.has(`${o.setName}:${o.itemId}`)).map((o) => o.id);
    if (staleIds.length) await prisma.promptTemplate.deleteMany({ where: { id: { in: staleIds } } });
  }
  return count;
}
