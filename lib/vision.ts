// Cloud Vision REST API（§8）：SafeSearch 複檢 + Image Properties 主色
import sharp from 'sharp';
import { getGoogleKey, isMockAi } from './ai-key';

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

export type SafeSearchVerdict = { safe: boolean; detail?: Record<string, string> };

const BAD = ['LIKELY', 'VERY_LIKELY'];

/** 輸出複檢：adult/violence/racy 等任何一項 LIKELY+ → 不安全（自動隱藏入待檢視） */
export async function safeSearchCheck(png: Buffer): Promise<SafeSearchVerdict> {
  const key = await getGoogleKey();
  if ((await isMockAi()) || !key) return { safe: true, detail: { mock: 'skipped' } };
  const res = await fetch(`${VISION_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: png.toString('base64') }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }],
    }),
  });
  if (!res.ok) return { safe: true, detail: { error: `vision ${res.status}` } };
  const json = await res.json();
  const ss = json.responses?.[0]?.safeSearchAnnotation ?? {};
  const unsafe = ['adult', 'violence', 'racy', 'medical'].some((k) => BAD.includes(ss[k]));
  return { safe: !unsafe, detail: ss };
}

export type Color = { hex: string; r: number; g: number; b: number };

/** 5 主色（junior-l5）。無 key 時用 sharp 取樣本地計算。 */
export async function dominantColors(png: Buffer): Promise<Color[]> {
  const key = await getGoogleKey();
  if (!(await isMockAi()) && key) {
    const res = await fetch(`${VISION_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: png.toString('base64') }, features: [{ type: 'IMAGE_PROPERTIES' }] }],
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const colors = json.responses?.[0]?.imagePropertiesAnnotation?.dominantColors?.colors ?? [];
      if (colors.length) {
        return colors.slice(0, 5).map((c: { color: { red?: number; green?: number; blue?: number } }) => {
          const r = Math.round(c.color.red ?? 0), g = Math.round(c.color.green ?? 0), b = Math.round(c.color.blue ?? 0);
          return { r, g, b, hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` };
        });
      }
    }
  }
  // 本地 fallback：縮到 8x8 取樣，粗略分桶
  const { data } = await sharp(png).resize(16, 16, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    buckets.set(key, { r: bucket.r + r, g: bucket.g + g, b: bucket.b + b, n: bucket.n + 1 });
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map(({ r, g, b, n }) => {
      const rr = Math.round(r / n), gg = Math.round(g / n), bb = Math.round(b / n);
      return { r: rr, g: gg, b: bb, hex: `#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('')}` };
    });
}
