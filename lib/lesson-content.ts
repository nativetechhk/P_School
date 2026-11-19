import { readFileSync } from 'fs';
import path from 'path';

export interface LessonContent {
  title: string;
  worksheetRef: string;
  steps: { text: string; imageKey?: string; worksheetQ?: string }[];
  tips: string[];
}

const map: Record<string, [string, string]> = {
  'senior-l3-character': ['senior', 'l3'],
  'senior-l4-scene': ['senior', 'l4'],
  'senior-l5-style': ['senior', 'l5'],
  'senior-l6-storybook': ['senior', 'l6'],
  'junior-l4-style': ['junior', 'l4'],
  'junior-l5-palette': ['junior', 'l5'],
  'junior-l6-poster': ['junior', 'l6'],
};

export function getLessonContent(lessonId: string): LessonContent | null {
  const entry = map[lessonId];
  if (!entry) return null;
  try {
    const p = path.resolve(process.cwd(), 'content', 'lessons', entry[0], `${entry[1]}.json`);
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
