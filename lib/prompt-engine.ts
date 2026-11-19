// Prompt Engine（§4.3）：四層模板組裝。模板存 DB，admin 改完即時生效。
import { prisma } from './db';

export interface AssembleInput {
  lessonId: string;
  slots: Record<string, string>; // slot -> option itemId；或 '__FREE__'
  freeTexts?: Record<string, string>; // slot -> 學生自由字（選了「自己講」時）
  freeText?: string; // {FREE} 位置的整句補充
  charName?: string;
}

export interface AssembledPrompt {
  promptSent: string;
  promptZh: string; // 顯示用中文整句（選項 labelZh 組成）
  aspect: string;
  templateVersion: number;
  styleBoost?: string;
  kind: string;
  flagged?: boolean;
}

export async function getGlobalTemplate() {
  const g = await prisma.promptTemplate.findFirst({ where: { level: 'global' } });
  const data = (g?.data ?? {}) as { prefix?: string; suffix?: string; negativeTerms?: string; humanBlockTerms?: string[] };
  return { row: g, prefix: data.prefix ?? '', suffix: data.suffix ?? '', negativeTerms: data.negativeTerms ?? '' };
}

export async function getLessonTemplate(lessonId: string) {
  return prisma.promptTemplate.findFirst({ where: { level: 'lesson', lessonId } });
}

export async function getOptionSet(setName: string, group?: 'junior' | 'senior') {
  const rows = await prisma.promptTemplate.findMany({
    where: {
      level: 'option', setName, enabled: true,
      ...(group ? { OR: [{ group }, { group: 'both' }] } : {}),
    },
    orderBy: { sortOrder: 'asc' },
  });
  return rows;
}

export async function assemblePrompt(input: AssembleInput): Promise<AssembledPrompt> {
  const lesson = await getLessonTemplate(input.lessonId);
  if (!lesson || !lesson.enabled) throw new Error('LESSON_TEMPLATE_DISABLED');
  const ldata = (lesson.data ?? {}) as {
    aspect?: string; slots?: string[]; optionSets?: Record<string, string>; kind?: string;
  };
  const g = await getGlobalTemplate();

  let template = lesson.promptZh ?? '';
  let display = '';
  let styleBoost = '';

  const slotNames = ldata.slots ?? [];
  for (const slot of slotNames) {
    const setName = ldata.optionSets?.[slot];
    const chosen = input.slots[slot];
    let promptPart = '';
    let labelPart = '';
    if (chosen === '__FREE__') {
      promptPart = (input.freeTexts?.[slot] ?? '').slice(0, 40);
      labelPart = promptPart;
    } else if (chosen && setName) {
      const opt = await prisma.promptTemplate.findFirst({
        where: { level: 'option', setName, itemId: chosen, enabled: true },
      });
      if (!opt) throw new Error(`OPTION_NOT_FOUND:${slot}:${chosen}`);
      promptPart = opt.promptZh ?? opt.labelZh ?? '';
      labelPart = opt.labelZh ?? '';
      if (opt.boostEn) styleBoost = styleBoost ? `${styleBoost}, ${opt.boostEn}` : opt.boostEn;
    }
    template = template.replaceAll(`{${slot}}`, promptPart);
    display = display ? `${display}，${labelPart}` : labelPart;
  }

  template = template
    .replaceAll('{FREE}', input.freeText ? `${input.freeText.slice(0, 40)}。` : '')
    .replaceAll('{CHAR_NAME}', input.charName ?? '')
    .replaceAll('{STYLE_BOOST}', '');

  const parts = [g.prefix, template.trim(), styleBoost, g.suffix].filter(Boolean);
  return {
    promptSent: parts.join(' '),
    promptZh: input.freeText ? `${display}，${input.freeText}` : display,
    aspect: ldata.aspect ?? '1:1',
    templateVersion: lesson.version,
    styleBoost,
    kind: ldata.kind ?? 'generate',
  };
}
