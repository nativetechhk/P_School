'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import PriorWorksPicker, { Artifact } from './PriorWorksPicker';
import { QuotaBar, type LessonMeta } from './workspaces';

function VoiceCaption({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  const [listening, setListening] = useState(false);
  function listen() {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) { alert('呢部電腦唔支援語音'); return; }
    const rec = new Rec(); rec.lang = 'yue-Hant-HK'; rec.interimResults = false; setListening(true);
    rec.onresult = (e: SpeechRecognitionEvent) => onChange(e.results[0][0].transcript);
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    rec.start();
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input className="field" value={value} placeholder={placeholder} maxLength={60} onChange={(e) => onChange(e.target.value)} />
      <button className="btn secondary" style={{ minHeight: 48, background: listening ? 'var(--color-accent)' : undefined, color: listening ? '#fff' : undefined }} onClick={listen}>🎤</button>
    </div>
  );
}

/** 第 6 節：作品輪播（junior-l6 / senior-l6）§5.1 CarouselBuilder */
export function CarouselWorkspace({ meta }: { meta: LessonMeta }) {
  const data = meta.data as { minWorks?: number; textTasks?: { summarize_script?: { enabled?: boolean } } };
  const minWorks = data.minWorks ?? 3;
  const [picked, setPicked] = useState<Artifact[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [reflection, setReflection] = useState(['', '', '']);
  const [script, setScript] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const canSummarize = meta.group === 'senior' && data.textTasks?.summarize_script?.enabled;

  async function summarize() {
    setSummarizing(true);
    try {
      const r = await api<{ result: { title?: string; pages?: string[] } }>('/api/text-task', { json: { lessonId: meta.id, task: 'summarize_script', input: script } });
      if (typeof r.result === 'object' && r.result) {
        if (r.result.title) setTitle(r.result.title);
        if (Array.isArray(r.result.pages)) {
          // 用縮寫逐頁做旁白，對應已揀作品
          const pages = r.result.pages.filter(Boolean);
          const next = { ...captions };
          picked.forEach((a, i) => { if (pages[i]) next[a.id] = pages[i]; });
          setCaptions(next);
        }
      }
    } catch { alert('AI 縮寫未能完成，可以自己打'); }
    setSummarizing(false);
  }

  async function make() {
    if (picked.length < minWorks) { setErr(`最少揀 ${minWorks} 件作品`); return; }
    setBusy(true); setErr('');
    try {
      const r = await api<{ ok: boolean; artifactId?: string; error?: string }>('/api/compose/carousel', {
        json: { lessonId: meta.id, title, reflection: reflection.filter(Boolean), slides: picked.map((a) => ({ artifactId: a.id, caption: captions[a.id] ?? '' })) },
      });
      if (r.ok === false) { setErr(r.error || '製作失敗'); setBusy(false); return; }
      const list = await api<{ artifacts: Artifact[] }>('/api/artifacts?role=carousel');
      setUrl(list.artifacts.find((a) => a.id === r.artifactId)?.url ?? null);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <QuotaBar quota={meta.quota} />
      <section className="card">
        <h3>1️⃣ 揀作品（最少 {minWorks} 件）</h3>
        <PriorWorksPicker roles={meta.consumes} multi max={12} onSelect={setPicked} demoFallback />
      </section>

      {canSummarize && (
        <section className="card">
          <h3>✍️ （可選）貼劇本，AI 幫你縮成每頁旁白</h3>
          <textarea className="field" style={{ minHeight: 100, padding: 12 }} value={script} onChange={(e) => setScript(e.target.value)} placeholder="貼返你嘅三幕式劇本…" />
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={summarize} disabled={!script || summarizing}>{summarizing ? 'AI 縮寫緊…' : '🤖 幫我縮寫（要你確認）'}</button>
        </section>
      )}

      {picked.length > 0 && (
        <section className="card">
          <h3>2️⃣ 每張講一句（可用 🎤）</h3>
          <input className="field" placeholder="作品集標題（例如：小火龍大冒險）" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {picked.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img src={a.thumbUrl ?? a.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><VoiceCaption value={captions[a.id] ?? ''} placeholder="講一句介紹呢張…" onChange={(v) => setCaptions({ ...captions, [a.id]: v })} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3>3️⃣ 我學到的 AI（3 句）</h3>
        {reflection.map((s, i) => <VoiceCaption key={i} value={s} placeholder={`第 ${i + 1} 句`} onChange={(v) => setReflection(reflection.map((x, j) => (j === i ? v : x)))} />)}
      </section>

      {err && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{err}</div>}
      <button className="btn lg" onClick={make} disabled={busy || picked.length < minWorks}>{busy ? '製作緊輪播…' : '🎠 整我的作品輪播'}</button>
      {url && (
        <section className="card" style={{ textAlign: 'center' }}>
          <h3>完成啦！🎉</h3>
          <a className="btn lg" href={url} target="_blank" rel="noreferrer">▶️ 開我的輪播</a>
          <p style={{ color: 'var(--color-muted)', marginTop: 8 }}>可以下載 HTML 離線播放，或畀導師投影。</p>
        </section>
      )}
    </div>
  );
}
