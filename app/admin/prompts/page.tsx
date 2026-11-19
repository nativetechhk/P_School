'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface Tpl {
  id: string; level: string; lessonId?: string; setName?: string; itemId?: string;
  labelZh?: string; promptZh?: string; boostEn?: string; icon?: string; group?: string;
  enabled: boolean; sortOrder: number; version: number; data?: Record<string, unknown>;
}

export default function PromptsPage() {
  const [data, setData] = useState<{ global: Tpl[]; lessons: Tpl[]; options: Tpl[] }>({ global: [], lessons: [], options: [] });
  const [edit, setEdit] = useState<Tpl | null>(null);
  const [preview, setPreview] = useState('');
  const [testImg, setTestImg] = useState('');
  const [testing, setTesting] = useState(false);

  async function load() { setData(await api('/api/admin/prompts')); }
  useEffect(() => { load(); }, []);

  async function save(t: Tpl) {
    await api('/api/admin/prompts', { method: 'PUT', json: t });
    setEdit(null); load();
  }
  async function toggle(t: Tpl) { await api('/api/admin/prompts', { method: 'PUT', json: { id: t.id, enabled: !t.enabled } }); load(); }

  async function runPreview(lessonId: string) {
    // 揀每個 slot 第一個啟用選項做預覽
    const lesson = data.lessons.find((l) => l.lessonId === lessonId);
    const sets = (lesson?.data?.optionSets ?? {}) as Record<string, string>;
    const slots: Record<string, string> = {};
    for (const [slot, setName] of Object.entries(sets)) {
      const first = data.options.find((o) => o.setName === setName && o.enabled);
      if (first?.itemId) slots[slot] = first.itemId;
    }
    try {
      const r = await api<{ promptSent: string }>('/api/admin/prompts/preview', { json: { lessonId, slots } });
      setPreview(r.promptSent);
      return { lessonId, slots };
    } catch (e) { setPreview('（' + (e as Error).message + '）'); return null; }
  }

  async function testGen(lessonId: string) {
    const p = await runPreview(lessonId);
    if (!p) return;
    setTesting(true); setTestImg('');
    try {
      const r = await api<{ dataUrl: string }>('/api/admin/prompts/test-generate', { json: p });
      setTestImg(r.dataUrl);
    } catch (e) { alert((e as Error).message); }
    setTesting(false);
  }

  const bySet = data.options.reduce<Record<string, Tpl[]>>((acc, o) => { (acc[o.setName!] ??= []).push(o); return acc; }, {});

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
      <div>
        <h1>🧩 Prompt 引擎</h1>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <a className="btn secondary" href="/api/admin/prompts/export" target="_blank" rel="noreferrer">⬇️ 匯出 JSON</a>
        </div>

        <section className="card" style={{ marginBottom: 16 }}>
          <h3>🌍 全域層</h3>
          {data.global.map((g) => (
            <div key={g.id}>
              <label>globalPrefix<input className="field" defaultValue={(g.data?.prefix as string) ?? ''} onBlur={(e) => save({ ...g, data: { ...g.data, prefix: e.target.value } })} /></label>
              <label>globalSuffix（含 no humans 防線，移除會增加風險 ⚠️）
                <textarea className="field" style={{ minHeight: 60, padding: 8 }} defaultValue={(g.data?.suffix as string) ?? ''} onBlur={(e) => save({ ...g, data: { ...g.data, suffix: e.target.value } })} /></label>
            </div>
          ))}
        </section>

        <section className="card" style={{ marginBottom: 16 }}>
          <h3>📚 課堂層</h3>
          {data.lessons.map((l) => (
            <div key={l.id} style={{ borderTop: '1px solid #eee', padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <b style={{ flex: 1 }}>{l.lessonId}</b>
                <label><input type="checkbox" checked={l.enabled} onChange={() => toggle(l)} /> 啟用</label>
                <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => setEdit(l)}>編輯模板</button>
                <button className="btn ghost" style={{ minHeight: 36 }} onClick={() => runPreview(l.lessonId!)}>預覽</button>
                <button className="btn secondary" style={{ minHeight: 36 }} onClick={() => testGen(l.lessonId!)}>試生成</button>
              </div>
              <code style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginTop: 4 }}>{l.promptZh}</code>
            </div>
          ))}
        </section>

        <section className="card">
          <h3>🎴 選項詞典</h3>
          {Object.entries(bySet).map(([setName, items]) => (
            <details key={setName} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{setName}（{items.length}）</summary>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {items.map((o) => (
                  <button key={o.id} onClick={() => setEdit(o)} style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: o.enabled ? '#eef' : '#f3f3f3', opacity: o.enabled ? 1 : 0.5, cursor: 'pointer' }}>
                    {o.icon} {o.labelZh}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </section>
      </div>

      <aside style={{ position: 'sticky', top: 20 }}>
        <div className="card">
          <h3>即時預覽</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#f6f4fa', padding: 10, borderRadius: 8, minHeight: 60 }}>{preview || '揀一個課堂撳「預覽」'}</pre>
          {testing && <div className="spin" />}
          {testImg && <img src={testImg} alt="試生成" style={{ borderRadius: 10, marginTop: 10 }} />}
        </div>
      </aside>

      {edit && (
        <div onClick={() => setEdit(null)} style={{ position: 'fixed', inset: 0, background: '#0008', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px,100%)' }}>
            <h3>編輯 {edit.level === 'option' ? '選項' : '課堂模板'}</h3>
            {edit.level === 'option' ? (
              <>
                <label>顯示名稱<input className="field" defaultValue={edit.labelZh} onChange={(e) => (edit.labelZh = e.target.value)} /></label>
                <label>送模型文字 promptZh<textarea className="field" style={{ minHeight: 50, padding: 8 }} defaultValue={edit.promptZh} onChange={(e) => (edit.promptZh = e.target.value)} /></label>
                <label>風格 boostEn<input className="field" defaultValue={edit.boostEn ?? ''} onChange={(e) => (edit.boostEn = e.target.value)} /></label>
                <label>icon<input className="field" defaultValue={edit.icon ?? ''} onChange={(e) => (edit.icon = e.target.value)} /></label>
                <label>group
                  <select className="field" defaultValue={edit.group ?? 'both'} onChange={(e) => (edit.group = e.target.value)}>
                    <option value="both">both</option><option value="junior">junior</option><option value="senior">senior</option>
                  </select>
                </label>
              </>
            ) : (
              <label>模板字串（{'{A}{B}{C}{D}{FREE}{STYLE}'} 變數）
                <textarea className="field" style={{ minHeight: 100, padding: 8 }} defaultValue={edit.promptZh} onChange={(e) => (edit.promptZh = e.target.value)} /></label>
            )}
            <label style={{ display: 'block', margin: '10px 0' }}><input type="checkbox" defaultChecked={edit.enabled} onChange={(e) => (edit.enabled = e.target.checked)} /> 啟用</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => save(edit)}>儲存（v{edit.version} → v{edit.version + 1}）</button>
              <button className="btn secondary" onClick={() => setEdit(null)}>取消</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>改完即時生效；自動保留前 20 版可還原。</p>
          </div>
        </div>
      )}
    </div>
  );
}
