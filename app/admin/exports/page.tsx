'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import ClassSelect from '@/components/admin/ClassSelect';

export default function ExportsPage() {
  const [classId, setClassId] = useState('');
  const [busy, setBusy] = useState('');

  async function download(url: string, body: object, filename: string) {
    setBusy(filename);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { alert((await res.json().catch(() => ({})))?.error ?? '匯出失敗'); setBusy(''); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    } catch (e) { alert((e as Error).message); }
    setBusy('');
  }

  return (
    <div>
      <h1>📦 匯出 / 完成作</h1>
      <div style={{ marginBottom: 16 }}><ClassSelect value={classId} onChange={setClassId} /></div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        <div className="card">
          <h3>批量匯出作品（ZIP）</h3>
          <p style={{ color: 'var(--color-muted)' }}>整班所有課堂圖片打包。</p>
          <button className="btn" disabled={!classId || !!busy} onClick={() => download('/api/admin/export/class', { classId }, `class-${classId}.zip`)}>
            {busy === `class-${classId}.zip` ? '打包中…' : '下載 ZIP'}
          </button>
        </div>
        <div className="card">
          <h3>🎓 完成作（全班作品集 PDF）</h3>
          <p style={{ color: 'var(--color-muted)' }}>每位學生一份「我的 AI 故事作品集」PDF，打包 ZIP。可能需時數分鐘。</p>
          <button className="btn accent2" disabled={!classId || !!busy} onClick={() => download('/api/admin/export/final-works', { classId }, `final-works-${classId}.zip`)}>
            {busy.startsWith('final') ? '生成中…（請耐心等）' : '一鍵產出全班完成作'}
          </button>
        </div>
      </div>
    </div>
  );
}
