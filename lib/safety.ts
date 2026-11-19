// 輸入安全（§7）：黑名單（含簡繁變體）→ 人類主體詞攔截
import { prisma } from './db';
// opencc-js 無型別定義
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OpenCC = require('opencc-js');

const toTrad: (s: string) => string = OpenCC.Converter({ from: 'cn', to: 'hk' });
const toSimp: (s: string) => string = OpenCC.Converter({ from: 'hk', to: 'cn' });

export interface SafetyResult {
  ok: boolean;
  action?: 'block' | 'flag' | 'human';
  term?: string;
  message?: string;
}

function variants(s: string): string[] {
  const lower = s.toLowerCase();
  return Array.from(new Set([lower, toTrad(lower), toSimp(lower)]));
}

let humanTermsCache: string[] | null = null;

export async function getHumanBlockTerms(): Promise<string[]> {
  if (humanTermsCache) return humanTermsCache;
  const g = await prisma.promptTemplate.findFirst({ where: { level: 'global' } });
  const data = (g?.data ?? {}) as { humanBlockTerms?: string[] };
  humanTermsCache = data.humanBlockTerms ?? [];
  setTimeout(() => (humanTermsCache = null), 30_000).unref?.();
  return humanTermsCache;
}

/** 對學生輸入（自由字／語音結果）做黑名單檢查。在 Prompt 組裝「之前」執行。 */
export async function checkStudentText(text: string): Promise<SafetyResult> {
  if (!text?.trim()) return { ok: true };
  const inputVariants = variants(text);

  // 人類主體詞（§4.2）
  const humanTerms = await getHumanBlockTerms();
  for (const term of humanTerms) {
    for (const v of inputVariants) {
      if (v.includes(term.toLowerCase())) {
        return { ok: false, action: 'human', term, message: '呢度畫動物或者奇幻角色先啦 🐱🦄' };
      }
    }
  }

  // admin 黑名單
  const rows = await prisma.blacklist.findMany();
  for (const row of rows) {
    for (const tv of variants(row.term)) {
      for (const v of inputVariants) {
        if (tv && v.includes(tv)) {
          if (row.mode === 'block') {
            return { ok: false, action: 'block', term: row.term, message: '呢個字唔可以用呀，試下第二個！' };
          }
          return { ok: true, action: 'flag', term: row.term };
        }
      }
    }
  }
  return { ok: true };
}
