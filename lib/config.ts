// 平台常量與課堂模組註冊（§5）
export type Group = 'junior' | 'senior';

export type LessonKind = 'generate' | 'edit' | 'vision' | 'compose' | 'two_step' | 'five_color' | 'carousel';

export interface LessonDef {
  id: string;
  group: Group;
  lessonNo: number;
  title: string;
  kind: LessonKind;
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
    id: 'senior-l6-carousel', group: 'senior', lessonNo: 6, title: '故事插圖輪播',
    kind: 'carousel', consumes: ['character', 'character_card', 'scene_1', 'scene_2', 'scene_3', 'styled'], produces: ['carousel'], defaultQuota: 0,
  },
  {
    id: 'junior-l4-generate-style', group: 'junior', lessonNo: 4, title: 'AI 畫畫＋名畫魔術師',
    // Step1 文生圖 → pet_original；Step2 圖生圖 → styled_pet
    kind: 'two_step', aspect: '1:1', consumes: [], produces: ['pet_original', 'styled_pet'], defaultQuota: 6,
  },
  {
    id: 'junior-l5-fivecolor', group: 'junior', lessonNo: 5, title: '五色魔法',
    kind: 'five_color', aspect: '1:1', consumes: ['styled_pet', 'pet_original'], produces: ['five_color'], defaultQuota: 6,
  },
  {
    id: 'junior-l6-carousel', group: 'junior', lessonNo: 6, title: '作品輪播',
    kind: 'carousel', consumes: ['pet_original', 'styled_pet', 'five_color'], produces: ['carousel'], defaultQuota: 0,
  },
];

export function lessonById(id: string): LessonDef | undefined {
  return LESSONS.find((l) => l.id === id);
}

// 舊 → 新 課堂 ID 對應（v2.3 → v2.4 migration）
export const LESSON_ID_MIGRATION: Record<string, string> = {
  'senior-l6-storybook': 'senior-l6-carousel',
  'junior-l4-style': 'junior-l4-generate-style',
  'junior-l5-palette': 'junior-l5-fivecolor',
  'junior-l6-poster': 'junior-l6-carousel',
};

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

// MOCK 判斷已改為動態（見 lib/ai-key isMockAi），因 key 可於 admin dashboard 設定。
