'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

type Settings = Record<string, string | number | boolean>;

const FIELDS: { key: string; label: string; type: 'number' | 'text' | 'bool' | 'select'; opts?: string[]; hint?: string }[] = [
  { key: 'dailyCapPerAccount', label: '每帳號每日生成上限', type: 'number' },
  { key: 'dailyCapGlobal', label: '全平台每日上限', type: 'number' },
  { key: 'maxConcurrentJobs', label: 'Worker 併發數', type: 'number', hint: '改後需重啟 worker' },
  { key: 'globalRpm', label: '全域 RPM（Gemini）', type: 'number', hint: 'Tier 1 建議 18' },
  { key: 'imagenRpm', label: 'Imagen RPM（備用）', type: 'number' },
  { key: 'imageModel', label: '主圖像模型', type: 'select', opts: ['gemini-2.5-flash-image', 'imagen-4.0-fast-generate-001'] },
  { key: 'fallbackImageModel', label: '備用模型', type: 'select', opts: ['imagen-4.0-fast-generate-001', 'gemini-2.5-flash-image'] },
  { key: 'imagesPerGeneration', label: '每次生成張數', type: 'number' },
  { key: 'costPerImageUsd', label: '每張估算成本（USD）', type: 'text' },
  { key: 'multiProjectRotation', label: '多專案輪替', type: 'bool', hint: '預設 off（屬規避，不建議）' },
];

export default function SettingsPage() {
  const [s, setS] = useState<Settings>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { api<{ settings: Settings }>('/api/admin/settings').then((r) => setS(r.settings)); }, []);

  async function save() {
    const r = await api<{ settings: Settings }>('/api/admin/settings', { method: 'PUT', json: s });
    setS(r.settings); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1>⚙️ 全域設定</h1>
      <div className="card" style={{ maxWidth: 600 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{f.label}</div>
              {f.hint && <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{f.hint}</div>}
            </div>
            {f.type === 'bool' ? (
              <input type="checkbox" checked={!!s[f.key]} onChange={(e) => setS({ ...s, [f.key]: e.target.checked })} style={{ width: 24, height: 24 }} />
            ) : f.type === 'select' ? (
              <select className="field" style={{ width: 280 }} value={String(s[f.key] ?? '')} onChange={(e) => setS({ ...s, [f.key]: e.target.value })}>
                {f.opts!.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="field" style={{ width: 160 }} type={f.type} value={String(s[f.key] ?? '')}
                onChange={(e) => setS({ ...s, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
            )}
          </div>
        ))}
        <button className="btn" style={{ marginTop: 16 }} onClick={save}>儲存設定</button>
        {saved && <span style={{ marginLeft: 12, color: 'var(--color-mint)' }}>已儲存 ✓</span>}
      </div>
    </div>
  );
}
