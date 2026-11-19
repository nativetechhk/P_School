'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import TopNav, { LessonTab } from '@/components/student/TopNav';
import { Artifact } from '@/components/student/PriorWorksPicker';

export default function MyWorksPage() {
  const router = useRouter();
  const [works, setWorks] = useState<Artifact[]>([]);
  const [tabs, setTabs] = useState<LessonTab[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ artifacts: Artifact[] }>('/api/artifacts')
      .then((r) => setWorks(r.artifacts))
      .catch((e) => { if ((e as { status?: number }).status === 401) router.push('/login'); });
    api<{ lessons: LessonTab[] }>('/api/lessons').then((r) => setTabs(r.lessons.map((l) => ({ id: l.id, title: l.title, lessonNo: l.lessonNo })))).catch(() => {});
  }, [router]);

  const byLesson = works.reduce<Record<string, Artifact[]>>((acc, a) => {
    (acc[a.lessonId] ??= []).push(a); return acc;
  }, {});

  function toggle(id: string) {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function favorite(a: Artifact) {
    await api('/api/artifacts', { method: 'PATCH', json: { id: a.id, favorite: !a.favorite } });
    setWorks(works.map((w) => (w.id === a.id ? { ...w, favorite: !w.favorite } : w)));
  }

  async function doExport(format: 'png' | 'zip' | 'pdf' | 'docx') {
    if (!selected.length && format !== 'pdf') { alert('揀返至少一件作品'); return; }
    setBusy(true);
    try {
      const r = await api<{ url: string }>('/api/export', { json: { artifactIds: selected.length ? selected : works.map((w) => w.id), format } });
      window.open(r.url, '_blank');
    } catch (e) { alert((e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <TopNav tabs={tabs} />
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 32 }}>🖼️ 我的作品</h1>
        <div style={{ position: 'sticky', top: 76, zIndex: 5, display: 'flex', gap: 10, flexWrap: 'wrap', background: '#fffdf9ee', padding: '10px 0', backdropFilter: 'blur(6px)' }}>
          <span style={{ alignSelf: 'center' }}>已揀 {selected.length} 件</span>
          <button className="btn secondary" onClick={() => doExport('png')} disabled={busy}>下載 PNG</button>
          <button className="btn secondary" onClick={() => doExport('zip')} disabled={busy}>ZIP</button>
          <button className="btn secondary" onClick={() => doExport('docx')} disabled={busy}>DOCX</button>
          <button className="btn" onClick={() => doExport('pdf')} disabled={busy}>📘 作品集 PDF</button>
        </div>

        {Object.keys(byLesson).length === 0 && <div className="card" style={{ marginTop: 20 }}>仲未有作品 😊</div>}
        {Object.entries(byLesson).map(([lessonId, items]) => (
          <section key={lessonId} style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 22 }}>{tabs.find((t) => t.id === lessonId)?.title ?? lessonId}</h2>
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
              {items.map((a) => (
                <div key={a.id} className="card" style={{ padding: 8, border: selected.includes(a.id) ? '4px solid var(--color-accent)' : '4px solid transparent' }}>
                  <img src={a.thumbUrl ?? a.url} alt={a.promptZh} onClick={() => toggle(a.id)} style={{ borderRadius: 10, aspectRatio: '1', objectFit: 'cover', cursor: 'pointer' }} />
                  <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '6px 0', minHeight: 20 }}>{a.promptZh}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn ghost" style={{ minHeight: 40, flex: 1 }} onClick={() => favorite(a)}>{a.favorite ? '⭐ 最鍾意' : '☆ 標記'}</button>
                    {(a.teacherHeart ?? 0) > 0 && <span style={{ alignSelf: 'center' }}>{'❤'.repeat(a.teacherHeart ?? 0)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
