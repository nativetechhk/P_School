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

interface Secrets { geminiApiKeySet: boolean; geminiApiKeyMasked: string; googleApiKeySet: boolean; googleApiKeyMasked: string }

export default function SettingsPage() {
  const [s, setS] = useState<Settings>({});
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [saved, setSaved] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [keyMsg, setKeyMsg] = useState('');

  function refresh() {
    api<{ settings: Settings; secrets: Secrets }>('/api/admin/settings').then((r) => { setS(r.settings); setSecrets(r.secrets); });
  }
  useEffect(() => { refresh(); }, []);

  async function save() {
    const r = await api<{ settings: Settings }>('/api/admin/settings', { method: 'PUT', json: s });
    setS(r.settings); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function saveKey(field: 'geminiApiKey' | 'googleApiKey', value: string) {
    const r = await api<{ secrets: Secrets }>('/api/admin/settings', { method: 'PUT', json: { [field]: value } });
    setSecrets(r.secrets); setGeminiKey(''); setGoogleKey('');
    setKeyMsg(value ? '已更新 API key ✓' : '已清除（回退環境變數）');
    setTimeout(() => setKeyMsg(''), 2500);
  }

  return (
    <div>
      <h1>⚙️ 全域設定</h1>

      {/* API Key 管理 */}
      <div className="card" style={{ maxWidth: 600, marginBottom: 20, border: '2px solid #ffe0b2' }}>
        <h3>🔑 AI API Key</h3>
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          於此設定可免重新部署更換 key。Key 以遮蔽形式顯示、永不回傳明文。清空輸入並儲存＝清除（回退伺服器環境變數）。
          <b style={{ color: 'var(--color-danger)' }}> 注意：key 以明文存於資料庫，請確保後台存取受控。</b>
        </p>
        <div style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 600 }}>Gemini API Key（主）</div>
          <div style={{ fontSize: 13, color: secrets?.geminiApiKeySet ? 'var(--color-mint)' : 'var(--color-danger)', marginBottom: 6 }}>
            {secrets?.geminiApiKeySet ? `已設定：${secrets.geminiApiKeyMasked}` : '未設定（MOCK 模式）'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="field" type="password" placeholder="貼上新 Gemini key" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} autoComplete="off" />
            <button className="btn" onClick={() => saveKey('geminiApiKey', geminiKey)} disabled={!geminiKey}>儲存</button>
            {secrets?.geminiApiKeySet && <button className="btn ghost" onClick={() => saveKey('geminiApiKey', '')}>清除</button>}
          </div>
        </div>
        <div style={{ padding: '10px 0' }}>
          <div style={{ fontWeight: 600 }}>Google API Key（Vision／Speech，選填）</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
            {secrets?.googleApiKeySet ? `已設定：${secrets.googleApiKeyMasked}（留空則沿用 Gemini key）` : '未設定（沿用 Gemini key）'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="field" type="password" placeholder="貼上 Google key（選填）" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} autoComplete="off" />
            <button className="btn" onClick={() => saveKey('googleApiKey', googleKey)} disabled={!googleKey}>儲存</button>
            {secrets?.googleApiKeySet && <button className="btn ghost" onClick={() => saveKey('googleApiKey', '')}>清除</button>}
          </div>
        </div>
        {keyMsg && <div style={{ color: 'var(--color-mint)', marginTop: 10 }}>{keyMsg}</div>}
      </div>

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
