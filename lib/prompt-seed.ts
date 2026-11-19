// 匯入 prompt_templates.seed.json 到 DB（§4.3）
import { prisma } from './db';

interface SeedFile {
  global?: { prefix?: string; suffix?: string; negativeTerms?: string; humanBlockTerms?: string[]; enabled?: boolean };
  lessons?: Record<string, Record<string, unknown>>;
  voice_hints?: { matchTemplate?: string };
  [setName: string]: unknown;
}

const OPTION_SETS = [
  'styles', 'masters', 'masters_junior', 'subjects_senior',
  'environments', 'scene_themes', 'details_lighting', 'tones_three_acts',
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
      await prisma.promptTemplate.upsert({
        where: { level_lessonId_setName_itemId: { level: 'option', lessonId: '', setName, itemId } },
        update: opts.overwrite ? {
          labelZh: item.labelZh as string, promptZh: item.promptZh as string, boostEn: (item.boostEn as string) ?? null,
          icon: item.icon as string, group: (item.group as string) ?? 'both', enabled: (item.enabled as boolean) ?? true,
          sortOrder: order, data: { blurb: item.blurb } as object,
        } : {},
        create: {
          level: 'option', lessonId: '', setName, itemId,
          labelZh: item.labelZh as string, promptZh: item.promptZh as string, boostEn: (item.boostEn as string) ?? null,
          icon: item.icon as string, group: (item.group as string) ?? 'both', enabled: (item.enabled as boolean) ?? true,
          sortOrder: order, data: { blurb: item.blurb } as object,
        },
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
  return count;
}
