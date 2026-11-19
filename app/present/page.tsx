'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';

interface Work { id: string; who: string; promptZh?: string; url: string; thumbUrl?: string; teacherHeart: number; status: string }
interface Cls { id: string; name: string }
interface Lesson { id: string; title: string; lessonNo: number }

function Present() {
  const sp = useSearchParams();
  const [classId, setClassId] = useState(sp.get('classId') ?? '');
  const [lessonId, setLessonId] = useState(sp.get('lessonId') ?? '');
  const [classes, setClasses] = useState<Cls[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [mode, setMode] = useState<'A' | 'B' | 'C'>('A');
  const [works, setWorks] = useState<Work[]>([]);
  const [zoom, setZoom] = useState<Work | null>(null);
  const [steps, setSteps] = useState<{ text: string; worksheetQ?: string }[]>([]);

  useEffect(() => { api<{ classes: Cls[] }>('/api/admin/classes').then((r) => { setClasses(r.classes); if (!classId && r.classes[0]) setClassId(r.classes[0].id); }); }, []); // eslint-disable-line
  useEffect(() => { api<{ lessons: Lesson[] }>('/api/lessons').then((r) => { setLessons(r.lessons); if (!lessonId && r.lessons[0]) setLessonId(r.lessons[0].id); }).catch(() => {}); }, []); // eslint-disable-line

  const loadWorks = useCallback(async () => {
    if (!classId || !lessonId) return;
    const r = await api<{ artifacts: Work[] }>(`/api/admin/works?classId=${classId}&lessonId=${lessonId}&status=ok`);
    setWorks(r.artifacts);
  }, [classId, lessonId]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  // 載入步驟卡（模式 B）
  useEffect(() => {
    if (!lessonId) return;
    import('@/lib/client').then(async () => {
      const r = await fetch(`/api/lessons`).then((x) => x.json()).catch(() => null);
      void r;
    });
  }, [lessonId]);

  // SSE 新作品飛入 + 隱藏（§3.5）
  useEffect(() => {
    if (!classId) return;
    const es = new EventSource(`/api/events?classId=${classId}&lessonId=${lessonId}`);
    es.addEventListener('artifact_new', () => loadWorks());
    es.addEventListener('artifact_hidden', (ev) => {
      const d = JSON.parse((ev as MessageEvent).data);
      setWorks((w) => w.filter((x) => x.id !== d.artifactId));
    });
    es.addEventListener('artifact_heart', (ev) => {
      const d = JSON.parse((ev as MessageEvent).data);
      setWorks((w) => w.map((x) => (x.id === d.artifactId ? { ...x, teacherHeart: d.hearts } : x)));
    });
    return () => es.close();
  }, [classId, lessonId, loadWorks]);

  // 鍵盤快捷：1/2/3 切模式、F 全螢幕、H 隱藏當前（§3.5）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '1') setMode('A');
      else if (e.key === '2') setMode('B');
      else if (e.key === '3') setMode('C');
      else if (e.key.toLowerCase() === 'f') { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
      else if (e.key.toLowerCase() === 'h' && zoom) {
        api('/api/admin/works', { method: 'PUT', json: { id: zoom.id, status: 'hidden' } });
        setWorks((w) => w.filter((x) => x.id !== zoom.id)); setZoom(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  async function heart(w: Work) {
    await api('/api/admin/works', { method: 'PUT', json: { id: w.id, teacherHeart: w.teacherHeart + 1 } });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0b1a', color: '#fff', padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
          {lessons.map((l) => <option key={l.id} value={l.id}>第 {l.lessonNo} 節 {l.title}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['A', 'B', 'C'] as const).map((m, i) => (
            <button key={m} onClick={() => setMode(m)} className="btn" style={{ minHeight: 44, background: mode === m ? 'var(--color-accent)' : '#2a2340' }}>
              {i + 1}. {m === 'A' ? '作品牆' : m === 'B' ? '步驟卡' : '示範生成'}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>快捷：1/2/3 切模式 · F 全螢幕 · H 隱藏（放大時）</span>
      </div>

      {mode === 'A' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {works.map((w) => (
            <div key={w.id} className="flyin" onClick={() => setZoom(w)} style={{ background: '#1b1530', borderRadius: 16, overflow: 'hidden', cursor: 'zoom-in', position: 'relative' }}>
              <img src={w.thumbUrl ?? w.url} alt={w.promptZh} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
              <div style={{ padding: 8, fontSize: 14 }}>{w.who} {w.teacherHeart > 0 && '❤'.repeat(w.teacherHeart)}</div>
            </div>
          ))}
          {!works.length && <div style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.5, fontSize: 24, padding: 60 }}>等緊同學作品…</div>}
        </div>
      )}

      {mode === 'B' && (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 28, opacity: 0.6 }}>{lessons.find((l) => l.id === lessonId)?.title}</div>
            <div style={{ fontSize: 56, fontWeight: 800, maxWidth: 1000 }}>睇住大螢幕，跟住導師一步步做！</div>
            <div style={{ fontSize: 24, opacity: 0.5, marginTop: 20 }}>（步驟卡內容見學生端「今日做咩？」）</div>
          </div>
        </div>
      )}

      {mode === 'C' && <DemoGenerate lessonId={lessonId} lessons={lessons} />}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, background: '#000d', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <img src={zoom.url} alt={zoom.promptZh} style={{ maxHeight: '75vh', borderRadius: 14 }} />
            <div style={{ marginTop: 14, fontSize: 24 }}>{zoom.who} · {zoom.promptZh}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn" onClick={() => heart(zoom)}>❤ 加星</button>
              <span style={{ alignSelf: 'center', opacity: 0.6 }}>撳 H 即時隱藏</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoGenerate({ lessonId, lessons }: { lessonId: string; lessons: Lesson[] }) {
  void lessons;
  const [img, setImg] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  async function gen() {
    setBusy(true); setImg('');
    try {
      const r = await api<{ dataUrl: string; promptSent: string }>('/api/admin/prompts/test-generate', {
        json: { lessonId, slots: { A: 's_dragon', B: 'e_skycity', C: 'd_rainbow', D: 'style_cartoon' } },
      });
      setImg(r.dataUrl); setPrompt(r.promptSent);
    } catch (e) { alert((e as Error).message); }
    setBusy(false);
  }
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
      <div style={{ textAlign: 'center' }}>
        <button className="btn lg" onClick={gen} disabled={busy}>{busy ? 'AI 畫緊…' : '🎬 示範生成（不計學生配額）'}</button>
        {prompt && <pre style={{ opacity: 0.6, maxWidth: 700, whiteSpace: 'pre-wrap', margin: '14px auto' }}>{prompt}</pre>}
        {img && <img src={img} alt="示範" style={{ maxHeight: '55vh', borderRadius: 14, marginTop: 14 }} />}
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><Present /></Suspense>; }
