import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, unauthorized, forbidden } from '@/lib/session';
import { getSettings, setSetting } from '@/lib/settings';
import { DEFAULT_SETTINGS } from '@/lib/config';
import { prisma } from '@/lib/db';
import { invalidateKeyCache, maskKey, getGeminiKey, getGoogleKey } from '@/lib/ai-key';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// API key 欄位：存於 settings，但永不回傳明文給前端（只回遮蔽值 + 是否已設定）
const SECRET_KEYS = ['geminiApiKey', 'googleApiKey'] as const;

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const settings = await getSettings();
  // 從輸出移除明文密鑰
  const safe = { ...settings } as Record<string, unknown>;
  for (const k of SECRET_KEYS) delete safe[k];
  return NextResponse.json({
    ok: true,
    settings: safe,
    secrets: {
      geminiApiKeySet: !!(await getGeminiKey()),
      geminiApiKeyMasked: maskKey(await getGeminiKey()),
      googleApiKeySet: !!(await getGoogleKey()),
      googleApiKeyMasked: maskKey(await getGoogleKey()),
    },
  });
}

export async function PUT(req: NextRequest) {
  const staff = await requireStaff('admin');
  if (!staff) return forbidden();
  const body = await req.json().catch(() => ({}));
  const allowed = Object.keys(DEFAULT_SETTINGS);

  // 一般設定
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) await setSetting(k, v);
  }

  // API key：空字串 = 清除（回退 env）；非空 = 設定；undefined = 不變
  for (const k of SECRET_KEYS) {
    if (!(k in body)) continue;
    const raw = String(body[k] ?? '').trim();
    if (raw === '') {
      await prisma.setting.delete({ where: { key: k } }).catch(() => {});
      await audit(staff.username!, 'clear_api_key', k);
    } else if (!raw.includes('•')) {
      // 忽略遮蔽佔位值（前端若原樣回傳遮蔽字串則不覆蓋）
      await setSetting(k, raw);
      await audit(staff.username!, 'set_api_key', k);
    }
  }
  invalidateKeyCache();

  const settings = await getSettings();
  const safe = { ...settings } as Record<string, unknown>;
  for (const k of SECRET_KEYS) delete safe[k];
  return NextResponse.json({
    ok: true,
    settings: safe,
    secrets: {
      geminiApiKeySet: !!(await getGeminiKey()),
      geminiApiKeyMasked: maskKey(await getGeminiKey()),
      googleApiKeySet: !!(await getGoogleKey()),
      googleApiKeyMasked: maskKey(await getGoogleKey()),
    },
  });
}
