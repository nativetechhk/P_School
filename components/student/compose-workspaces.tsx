'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import PriorWorksPicker, { Artifact } from './PriorWorksPicker';
import type { LessonMeta } from './workspaces';

function VoiceSentence({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  const [listening, setListening] = useState(false);
  function speak() {
    try { const u = new SpeechSynthesisUtterance(value); u.lang = 'zh-HK'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* */ }
  }
  function listen() {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) { alert('呢部電腦唔支援語音'); return; }
    const rec = new Rec(); rec.lang = 'yue-Hant-HK'; rec.interimResults = false;
    setListening(true);
    rec.onresult = (e: SpeechRecognitionEvent) => onChange(e.results[0][0].transcript);
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    rec.start();
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input className="field" value={value} placeholder={placeholder} maxLength={20} onChange={(e) => onChange(e.target.value)} />
      <button className="btn secondary" style={{ minHeight: 48, background: listening ? 'var(--color-accent)' : undefined, color: listening ? '#fff' : undefined }} onClick={listen}>🎤</button>
      <button className="btn secondary" style={{ minHeight: 48 }} onClick={speak}>🔊</button>
    </div>
  );
}

/** junior-l6 海報 */
export function PosterWorkspace({ meta }: { meta: LessonMeta }) {
  const [original, setOriginal] = useState<Artifact | null>(null);
  const [styled, setStyled] = useState<Artifact | null>(null);
  const [name, setName] = useState('');
  const [sentences, setSentences] = useState(['', '', '']);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  void meta;

  async function make() {
    setBusy(true);
    const r = await api<{ artifactId: string }>('/api/compose/poster', {
      json: { originalId: original?.id, styledId: styled?.id, name, sentences: sentences.filter(Boolean) },
    });
    const list = await api<{ artifacts: Artifact[] }>('/api/artifacts?role=poster');
    setPosterUrl(list.artifacts.find((a) => a.id === r.artifactId)?.url ?? null);
    setBusy(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="card"><h3>1️⃣ 揀原圖（我畫嘅寵物）</h3>
        <PriorWorksPicker roles={['pet_original']} onSelect={(a) => setOriginal(a[0] ?? null)} demoFallback /></section>
      <section className="card"><h3>2️⃣ 揀名畫風圖</h3>
        <PriorWorksPicker roles={['styled_pet', 'coloring']} onSelect={(a) => setStyled(a[0] ?? null)} demoFallback /></section>
      <section className="card">
        <h3>3️⃣ 幫寵物改名 + 講三句話</h3>
        <input className="field" placeholder="寵物個名" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {sentences.map((s, i) => (
            <VoiceSentence key={i} value={s} placeholder={`第 ${i + 1} 句`} onChange={(v) => setSentences(sentences.map((x, j) => (j === i ? v : x)))} />
          ))}
        </div>
      </section>
      <button className="btn lg" onClick={make} disabled={busy || (!original && !styled)}>{busy ? '整緊…' : '🖼️ 整海報'}</button>
      {posterUrl && (
        <section className="card"><h3>我嘅海報 🎉</h3><img src={posterUrl} alt="海報" style={{ borderRadius: 12 }} />
          <ExportButtons artifactId={posterUrl ? undefined : undefined} /></section>
      )}
    </div>
  );
}

/** senior-l6 故事書 */
export function StorybookWorkspace({ meta }: { meta: LessonMeta }) {
  const [script, setScript] = useState('');
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<{ artifactId?: string; heading?: string; text: string }[]>([
    { heading: '主角', text: '' }, { heading: '第 1 幕：開始', text: '' },
    { heading: '第 2 幕：危機', text: '' }, { heading: '第 3 幕：解決', text: '' },
  ]);
  const [threeSentences, setThreeSentences] = useState(['', '', '']);
  const [summarizing, setSummarizing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  void meta;

  async function summarize() {
    setSummarizing(true);
    try {
      const r = await api<{ result: { title?: string; pages?: string[] } }>('/api/text-task', {
        json: { lessonId: 'senior-l6-storybook', task: 'summarize_script', input: script },
      });
      if (typeof r.result === 'object' && r.result) {
        if (r.result.title) setTitle(r.result.title);
        if (Array.isArray(r.result.pages)) {
          setPages(pages.map((p, i) => ({ ...p, text: r.result.pages![i + 1] ?? p.text })));
        }
      }
    } catch { alert('縮寫未能完成，請自己打'); }
    setSummarizing(false);
  }

  async function make() {
    setBusy(true);
    const r = await api<{ artifactId: string }>('/api/compose/storybook', {
      json: { title, pages, threeSentences: threeSentences.filter(Boolean) },
    });
    const list = await api<{ artifacts: Artifact[] }>('/api/artifacts?role=storybook');
    setPdfUrl(list.artifacts.find((a) => a.id === r.artifactId)?.url ?? null);
    setBusy(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="card">
        <h3>1️⃣ 打／貼你嘅劇本</h3>
        <textarea className="field" style={{ minHeight: 120, padding: 12, resize: 'vertical' }} value={script} onChange={(e) => setScript(e.target.value)} placeholder="貼返你嘅三幕式劇本…" />
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={summarize} disabled={!script || summarizing}>
          {summarizing ? 'AI 縮寫緊…' : '🤖 幫我縮成每頁 2 句（要你確認）'}
        </button>
      </section>
      <section className="card">
        <h3>2️⃣ 砌 6 頁範本</h3>
        <input className="field" placeholder="書名（封面）" value={title} onChange={(e) => setTitle(e.target.value)} />
        {pages.map((p, i) => (
          <div key={i} style={{ marginTop: 14, borderTop: '1px dashed #eee', paddingTop: 12 }}>
            <b>{p.heading}</b>
            <PriorWorksPicker roles={['character', 'character_card', 'scene_1', 'scene_2', 'scene_3', 'styled']}
              onSelect={(a) => setPages(pages.map((x, j) => (j === i ? { ...x, artifactId: a[0]?.id } : x)))} />
            <textarea className="field" style={{ minHeight: 60, padding: 10, marginTop: 8 }} value={p.text} maxLength={120}
              onChange={(e) => setPages(pages.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="呢頁嘅文字（最多 2 句）" />
          </div>
        ))}
      </section>
      <section className="card">
        <h3>3️⃣ 我學到的 AI（3 句）</h3>
        {threeSentences.map((s, i) => (
          <VoiceSentence key={i} value={s} placeholder={`第 ${i + 1} 句`} onChange={(v) => setThreeSentences(threeSentences.map((x, j) => (j === i ? v : x)))} />
        ))}
      </section>
      <button className="btn lg" onClick={make} disabled={busy}>{busy ? '整緊故事書…' : '📖 整本故事書（PDF）'}</button>
      {pdfUrl && (
        <section className="card" style={{ textAlign: 'center' }}>
          <h3>完成啦！🎉</h3>
          <a className="btn lg" href={pdfUrl} target="_blank" rel="noreferrer">📥 下載故事書 PDF</a>
        </section>
      )}
    </div>
  );
}

function ExportButtons({ artifactId }: { artifactId?: string }) {
  void artifactId;
  return null;
}
