'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import ClassSelect from '@/components/admin/ClassSelect';

interface Student { id: string; username: string; initialPassword?: string; active: boolean; locked: boolean }

function AccountsInner() {
  const sp = useSearchParams();
  const [classId, setClassId] = useState(sp.get('classId') ?? '');
  const [students, setStudents] = useState<Student[]>([]);
  const [prefix, setPrefix] = useState('S4-');
  const [count, setCount] = useState(20);

  async function load() {
    if (!classId) return;
    setStudents((await api<{ students: Student[] }>(`/api/admin/accounts?classId=${classId}`)).students);
  }
  useEffect(() => { load(); }, [classId]); // eslint-disable-line

  async function bulk() {
    await api('/api/admin/accounts', { json: { action: 'bulk-generate', classId, prefix, count } });
    load();
  }
  async function act(action: string, studentId: string, extra?: object) {
    const r = await api<{ password?: string }>('/api/admin/accounts', { json: { action, studentId, ...extra } });
    if (r.password) alert(`新密碼：${r.password}`);
    load();
  }

  return (
    <div>
      <h1>🎟️ 帳號 + 派發卡</h1>
      <div style={{ marginBottom: 16 }}><ClassSelect value={classId} onChange={setClassId} /></div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>批量生成帳號</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>前綴 <input className="field" style={{ width: 120, display: 'inline-block' }} value={prefix} onChange={(e) => setPrefix(e.target.value)} /></label>
          <label>數量 <input className="field" type="number" style={{ width: 100, display: 'inline-block' }} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
          <button className="btn" onClick={bulk} disabled={!classId}>生成</button>
          <a className="btn secondary" href={`/api/admin/accounts/cards.pdf?classId=${classId}`} target="_blank" rel="noreferrer">🖨️ 列印派發卡 PDF</a>
          <a className="btn secondary" href={`/api/admin/accounts/export.csv?classId=${classId}`}>⬇️ CSV</a>
        </div>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--color-muted)' }}><th>帳號</th><th>初始密碼</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '10px 0', fontWeight: 700 }}>{s.username}</td>
                <td style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{s.initialPassword ?? '(已改)'}</td>
                <td>{!s.active ? '🚫 停用' : s.locked ? '🔒 鎖定' : '✅'}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn ghost" style={{ minHeight: 40 }} onClick={() => act('reset', s.id)}>重設密碼</button>
                  {s.locked && <button className="btn ghost" style={{ minHeight: 40 }} onClick={() => act('unlock', s.id)}>解鎖</button>}
                  <button className="btn ghost" style={{ minHeight: 40 }} onClick={() => act('toggle', s.id, { active: !s.active })}>{s.active ? '停用' : '啟用'}</button>
                  <button className="btn ghost" style={{ minHeight: 40, color: 'var(--color-danger)' }} onClick={() => confirm('刪除帳號連作品？') && act('delete', s.id)}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!students.length && <div style={{ color: 'var(--color-muted)', padding: 20, textAlign: 'center' }}>仲未有帳號，上面批量生成啦</div>}
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><AccountsInner /></Suspense>; }
