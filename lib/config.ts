// 平台常量與課堂模組註冊（§5）
export type Group = 'junior' | 'senior';

export interface LessonDef {
  id: string;
  group: Group;
  lessonNo: number;
  title: string;
  kind: 'generate' | 'edit' | 'vision' | 'compose';
  aspect?: '3:4' | '16:9' | '1:1' | 'keep';
  consumes: string[]; // 承接的 artifact roles
  produces: string[];
  defaultQuota: number;
}

export const LESSONS: LessonDef[] = [
  {
    id: 'senior-l3-character', group: 'senior', lessonNo: 3, title: '主角設定卡',
    kind: 'generate', aspect: '3:4', consumes: [], produces: ['character', 'character_card'], defaultQuota: 10,
  },
  {
    id: 'senior-l4-scene', group: 'senior', lessonNo: 4, title: '三幕場景',
    kind: 'generate', aspect: '16:9', consumes: ['character'], produces: ['scene_1', 'scene_2', 'scene_3'], defaultQuota: 10,
  },
  {
    id: 'senior-l5-style', group: 'senior', lessonNo: 5, title: '大師風格轉換',
    kind: 'edit', aspect: 'keep', consumes: ['character', 'scene_1', 'scene_2', 'scene_3'], produces: ['styled'], defaultQuota: 8,
  },
  {
    id: 'senior-l6-storybook', group: 'senior', lessonNo: 6, title: '我的 AI 故事書',
    kind: 'compose', consumes: ['character', 'character_card', 'scene_1', 'scene_2', 'scene_3', 'styled'], produces: ['storybook'], defaultQuota: 0,
  },
  {
    id: 'junior-l4-style', group: 'junior', lessonNo: 4, title: '名畫風寵物',
    // pet_original 由上載建立（非 AI 生成）；AI 編輯輸出為 styled_pet，故 produces[0] 必須係 styled_pet
    kind: 'edit', aspect: 'keep', consumes: ['pet_original'], produces: ['styled_pet'], defaultQuota: 6,
  },
  {
    id: 'junior-l5-palette', group: 'junior', lessonNo: 5, title: '顏色配方',
    kind: 'vision', consumes: ['styled_pet', 'pet_original'], produces: ['palette', 'coloring'], defaultQuota: 0,
  },
  {
    id: 'junior-l6-poster', group: 'junior', lessonNo: 6, title: '我的魔法寵物海報',
    kind: 'compose', consumes: ['pet_original', 'styled_pet', 'coloring', 'palette'], produces: ['poster'], defaultQuota: 0,
  },
];

export function lessonById(id: string): LessonDef | undefined {
  return LESSONS.find((l) => l.id === id);
}

export const DEFAULT_SETTINGS = {
  dailyCapPerAccount: 20,
  dailyCapGlobal: 800,
  maxConcurrentJobs: 3,
  globalRpm: 18,
  imagenRpm: 10,
  imageModel: 'gemini-2.5-flash-image',
  fallbackImageModel: 'imagen-4.0-fast-generate-001',
  textModel: 'gemini-2.5-flash',
  fixedSuffix: '', // 以 prompt_templates global 層為準；此處保留覆蓋位
  multiProjectRotation: false,
  imagesPerGeneration: 2,
  costPerImageUsd: 0.04,
} as const;

export type Settings = { [K in keyof typeof DEFAULT_SETTINGS]: (typeof DEFAULT_SETTINGS)[K] extends boolean ? boolean : (typeof DEFAULT_SETTINGS)[K] extends number ? number : string };

export const HK_TZ = 'Asia/Hong_Kong';

export function hkToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export const IS_MOCK_AI = !process.env.GEMINI_API_KEY;
