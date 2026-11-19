'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

interface Cls { id: string; name: string; group: string; note?: string; _count: { students: number } }

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Cls[]>([]);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<'junior' | 'senior'>('senior');
  const [note, setNote] = useState('');

  async function load() {
    try { setClasses((await api<{ classes: Cls[] }>('/api/admin/classes')).classes); }
    catch (e) { if ((e as { status?: number }).status === 401) router.push('/admin/login'); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function create() {
    if (!name) return;
    await api('/api/admin/classes', { json: { name, group, note } });
    setName(''); setNote(''); load();
  }
  async function del(id: string) {
    if (!confirm('確定刪除呢班？連埋學生同作品都會刪！')) return;
    await api(`/api/admin/classes?id=${id}`, { method: 'DELETE' }); load();
  }

  return (
    <div>
      <h1>🏫 班別管理</h1>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>新增班別</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field" style={{ maxWidth: 240 }} placeholder="班名" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="field" style={{ maxWidth: 160 }} value={group} onChange={(e) => setGroup(e.target.value as 'junior' | 'senior')}>
            <option value="senior">高年級 P.4–6</option>
            <option value="junior">低年級 P.1–3</option>
          </select>
          <input className="field" style={{ maxWidth: 240 }} placeholder="備註（選填）" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" onClick={create}>建立</button>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        {classes.map((c) => (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{c.name}</h3>
              <span style={{ fontSize: 13, padding: '2px 10px', borderRadius: 10, background: c.group === 'senior' ? '#e3f0ff' : '#ffe9f3' }}>{c.group === 'senior' ? '高年級' : '低年級'}</span>
            </div>
            <div style={{ color: 'var(--color-muted)', margin: '8px 0' }}>{c._count.students} 位學生{c.note ? ` · ${c.note}` : ''}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a className="btn secondary" style={{ minHeight: 44, flex: 1, textDecoration: 'none' }} href={`/admin/accounts?classId=${c.id}`}>帳號</a>
              <a className="btn secondary" style={{ minHeight: 44, flex: 1, textDecoration: 'none' }} href={`/admin/lessons?classId=${c.id}`}>課堂</a>
              <button className="btn ghost" style={{ minHeight: 44 }} onClick={() => del(c.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
