// API key 解析（admin dashboard 可改，DB 優先、env 後備）。
// 短 TTL 快取：admin 改完最多 5 秒生效，worker 無需重啟。
import { prisma } from './db';

const TTL_MS = 5000;
let cache: { gemini: string; google: string; at: number } | null = null;

async function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const rows = await prisma.setting.findMany({ where: { key: { in: ['geminiApiKey', 'googleApiKey'] } } }).catch(() => []);
  const map = Object.fromEntries(rows.map((r) => [r.key, typeof r.value === 'string' ? r.value : '']));
  const gemini = (map.geminiApiKey as string) || process.env.GEMINI_API_KEY || '';
  const google = (map.googleApiKey as string) || process.env.GOOGLE_API_KEY || gemini;
  cache = { gemini, google, at: Date.now() };
  return cache;
}

export async function getGeminiKey(): Promise<string> {
  return (await load()).gemini;
}

export async function getGoogleKey(): Promise<string> {
  return (await load()).google;
}

export async function isMockAi(): Promise<boolean> {
  return !(await getGeminiKey());
}

export function invalidateKeyCache() {
  cache = null;
}

/** 遮蔽 key 供前端顯示（只回尾 4 碼） */
export function maskKey(key?: string | null): string {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `••••••••${key.slice(-4)}`;
}
