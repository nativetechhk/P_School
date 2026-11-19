'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface Term { id: string; term: string; mode: string; createdBy?: string }

export default function BlacklistPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [term, setTerm] = useState('');
  const [mode, setMode] = useState<'block' | 'flag'>('block');

  async function load() { setTerms((await api<{ terms: Term[] }>('/api/admin/blacklist')).terms); }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!term) return;
    await api('/api/admin/blacklist', { json: { term, mode } }); setTerm(''); load();
  }
  async function del(id: string) { await api(`/api/admin/blacklist?id=${id}`, { method: 'DELETE' }); load(); }

  async function importCsv(file: File) {
    const text = await file.text();
    const csv = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [t, m] = l.split(',');
      return { term: t?.replace(/"/g, '').trim(), mode: m?.trim() === 'flag' ? 'flag' : 'block' };
    }).filter((r) => r.term);
    await api('/api/admin/blacklist', { json: { csv } }); load();
  }

  return (
    <div>
      <h1>🚫 黑名單關鍵字</h1>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field" style={{ maxWidth: 240 }} placeholder="新增詞語（支援簡繁粵語）" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select className="field" style={{ maxWidth: 140 }} value={mode} onChange={(e) => setMode(e.target.value as 'block' | 'flag')}>
            <option value="block">攔截</option>
            <option value="flag">只標記</option>
          </select>
          <button className="btn" onClick={add}>新增</button>
          <label className="btn secondary">匯入 CSV<input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} /></label>
        </div>
        <p style={{ color: 'var(--color-muted)', marginTop: 10 }}>人類主體詞（男孩／女孩／學生…）已內建於 Prompt Engine 全域層，命中即攔截。此處可加其他不當詞。</p>
      </div>
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {terms.map((t) => (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: t.mode === 'block' ? '#ffe0e0' : '#fff3cd' }}>
              {t.term} <small>({t.mode === 'block' ? '攔' : '標'})</small>
              <button onClick={() => del(t.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </span>
          ))}
          {!terms.length && <span style={{ color: 'var(--color-muted)' }}>暫無自訂詞語</span>}
        </div>
      </div>
    </div>
  );
}
