'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import ClassSelect from '@/components/admin/ClassSelect';

interface Row { lessonId: string; title: string; lessonNo: number; enabled: boolean; quotaPerStudent: number; cooldownSeconds: number }

function LessonsInner() {
  const sp = useSearchParams();
  const [classId, setClassId] = useState(sp.get('classId') ?? '');
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    if (!classId) return;
    setRows((await api<{ lessons: Row[] }>(`/api/admin/access?classId=${classId}`)).lessons);
  }
  useEffect(() => { load(); }, [classId]); // eslint-disable-line

  async function save(r: Row, patch: Partial<Row>) {
    const next = { ...r, ...patch };
    setRows(rows.map((x) => (x.lessonId === r.lessonId ? next : x)));
    await api('/api/admin/access', { method: 'PUT', json: { classId, lessonId: r.lessonId, enabled: next.enabled, quotaPerStudent: next.quotaPerStudent, cooldownSeconds: next.cooldownSeconds } });
  }

  return (
    <div>
      <h1>🔓 課堂開關／配額</h1>
      <div style={{ marginBottom: 16 }}><ClassSelect value={classId} onChange={setClassId} /></div>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--color-muted)' }}><th>課堂</th><th>開放</th><th>每人配額</th><th>冷卻秒數</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lessonId} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '12px 0', fontWeight: 700 }}>第 {r.lessonNo} 節 · {r.title}</td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={r.enabled} onChange={(e) => save(r, { enabled: e.target.checked })} style={{ width: 24, height: 24 }} />
                    {r.enabled ? '開' : '關'}
                  </label>
                </td>
                <td><input className="field" type="number" style={{ width: 90 }} value={r.quotaPerStudent} onChange={(e) => save(r, { quotaPerStudent: Number(e.target.value) })} /></td>
                <td><input className="field" type="number" style={{ width: 90 }} value={r.cooldownSeconds} onChange={(e) => save(r, { cooldownSeconds: Number(e.target.value) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: 'var(--color-muted)', marginTop: 12 }}>關閉後學生仍可睇、匯出本節作品，但唔可以再生成。</p>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><LessonsInner /></Suspense>; }
