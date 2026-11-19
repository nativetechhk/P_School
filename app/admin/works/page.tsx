'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import ClassSelect from '@/components/admin/ClassSelect';

interface Work { id: string; who: string; lessonId: string; promptZh?: string; status: string; teacherHeart: number; teacherNote?: string; thumbUrl?: string; url: string }

export default function WorksPage() {
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [works, setWorks] = useState<Work[]>([]);
  const [zoom, setZoom] = useState<Work | null>(null);

  async function load() {
    const qs = new URLSearchParams();
    if (classId) qs.set('classId', classId);
    if (status) qs.set('status', status);
    setWorks((await api<{ artifacts: Work[] }>(`/api/admin/works?${qs}`)).artifacts);
  }
  useEffect(() => { load(); }, [classId, status]); // eslint-disable-line

  async function update(id: string, patch: object) {
    await api('/api/admin/works', { method: 'PUT', json: { id, ...patch } }); load();
    setZoom(null);
  }

  return (
    <div>
      <h1>🖼️ 作品牆 / 審核</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <ClassSelect value={classId} onChange={setClassId} />
        <select className="field" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部（除已刪）</option>
          <option value="ok">正常</option>
          <option value="review">待檢視</option>
          <option value="hidden">已隱藏</option>
        </select>
      </div>
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
        {works.map((w) => (
          <div key={w.id} className="card" style={{ padding: 8, border: w.status === 'review' ? '3px solid var(--color-sun)' : w.status === 'hidden' ? '3px solid #ccc' : '3px solid transparent' }}>
            <img src={w.thumbUrl ?? w.url} alt={w.promptZh} onClick={() => setZoom(w)} style={{ borderRadius: 8, aspectRatio: '1', objectFit: 'cover', cursor: 'zoom-in', opacity: w.status === 'hidden' ? 0.4 : 1 }} />
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{w.who} · {w.status}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button className="btn ghost" style={{ minHeight: 36, flex: 1, fontSize: 14 }} onClick={() => update(w.id, { teacherHeart: w.teacherHeart + 1 })}>❤{w.teacherHeart || ''}</button>
              <button className="btn ghost" style={{ minHeight: 36, fontSize: 14 }} onClick={() => update(w.id, { status: w.status === 'hidden' ? 'ok' : 'hidden' })}>{w.status === 'hidden' ? '👁️' : '🙈'}</button>
              <button className="btn ghost" style={{ minHeight: 36, fontSize: 14, color: 'var(--color-danger)' }} onClick={() => confirm('刪除？') && update(w.id, { status: 'deleted' })}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      {!works.length && <div className="card">冇作品</div>}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, background: '#000b', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <img src={zoom.url} alt={zoom.promptZh} style={{ borderRadius: 10, maxHeight: '60vh', margin: '0 auto' }} />
            <p><b>{zoom.who}</b> · {zoom.promptZh}</p>
            <textarea className="field" placeholder="導師評語（學生可見）" defaultValue={zoom.teacherNote} id="note" style={{ minHeight: 60, padding: 10 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={() => update(zoom.id, { teacherNote: (document.getElementById('note') as HTMLTextAreaElement).value })}>儲存評語</button>
              <button className="btn secondary" onClick={() => update(zoom.id, { status: 'hidden' })}>隱藏</button>
              <button className="btn ghost" style={{ color: 'var(--color-danger)' }} onClick={() => update(zoom.id, { status: 'deleted' })}>刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
