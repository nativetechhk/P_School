'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface Cls { id: string; name: string }

export default function DataPage() {
  const [classes, setClasses] = useState<Cls[]>([]);
  const [classId, setClassId] = useState('');
  const [target, setTarget] = useState<'artifacts' | 'accounts'>('artifacts');
  const [confirmName, setConfirmName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { api<{ classes: Cls[] }>('/api/admin/classes').then((r) => { setClasses(r.classes); setClassId(r.classes[0]?.id ?? ''); }); }, []);
  const cls = classes.find((c) => c.id === classId);

  async function run() {
    if (!cls) return;
    if (confirmName !== cls.name) { alert('請準確輸入班名作第二步確認'); return; }
    if (!confirm(`最後確認：真係要批量刪除「${cls.name}」嘅${target === 'artifacts' ? '作品' : '帳號'}？此動作不可還原！`)) return;
    const r = await api<{ deleted: number }>('/api/admin/data/bulk-delete', { json: { classId, target, confirmName, from: from || undefined, to: to || undefined } });
    alert(`已刪除 ${r.deleted} 項`);
    setConfirmName('');
  }

  return (
    <div>
      <h1>🗑️ 資料管理（批量刪除）</h1>
      <div className="card" style={{ maxWidth: 560, border: '2px solid #ffd5d5' }}>
        <p style={{ color: 'var(--color-danger)', fontWeight: 700 }}>⚠️ 批量刪除不可還原，需兩步確認。平台無自動刪除排程。</p>
        <label style={{ display: 'block', margin: '10px 0' }}>班別
          <select className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'block', margin: '10px 0' }}>刪除目標
          <select className="field" value={target} onChange={(e) => setTarget(e.target.value as 'artifacts' | 'accounts')}>
            <option value="artifacts">作品（可按日期範圍）</option>
            <option value="accounts">帳號（連作品）</option>
          </select>
        </label>
        {target === 'artifacts' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>由<input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label style={{ flex: 1 }}>至<input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        <label style={{ display: 'block', margin: '10px 0' }}>輸入班名確認：<b>{cls?.name}</b>
          <input className="field" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="輸入班名" />
        </label>
        <button className="btn" style={{ background: 'var(--color-danger)' }} onClick={run} disabled={!cls || confirmName !== cls?.name}>執行批量刪除</button>
      </div>
    </div>
  );
}
