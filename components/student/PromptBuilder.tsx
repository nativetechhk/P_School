'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

export interface Option { id: string; icon?: string; labelZh: string }
export interface SlotDef { slot: string; label: string; setName?: string; options: Option[] }

interface Props {
  slots: SlotDef[];
  group: 'junior' | 'senior';
  onChange: (sel: Record<string, string>, freeTexts: Record<string, string>, sentence: string) => void;
}

// Prompt Builder（§4.2）：圖文選項卡 + 🎲隨機 + 🎤語音 + TTS 朗讀
export default function PromptBuilder({ slots, group, onChange }: Props) {
  const [sel, setSel] = useState<Record<string, string>>({});
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [listening, setListening] = useState<string | null>(null);
  const [voiceHints, setVoiceHints] = useState<Record<string, Option[]>>({});
  const perPage = group === 'junior' ? 4 : 6;

  function speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-HK';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* no TTS */ }
  }

  function sentence(next: Record<string, string>, nextFree: Record<string, string>): string {
    return slots.map((s) => {
      const v = next[s.slot];
      if (v === '__FREE__') return nextFree[s.slot] || '…';
      const opt = s.options.find((o) => o.id === v);
      return opt?.labelZh ?? '…';
    }).filter((x) => x !== '…').join('，');
  }

  function pick(slot: string, id: string) {
    const next = { ...sel, [slot]: id };
    setSel(next);
    const sent = sentence(next, freeTexts);
    onChange(next, freeTexts, sent);
    if (sent) speak(sent);
  }

  function setFree(slot: string, text: string) {
    const nextFree = { ...freeTexts, [slot]: text };
    const next = { ...sel, [slot]: '__FREE__' };
    setFreeTexts(nextFree); setSel(next);
    onChange(next, nextFree, sentence(next, nextFree));
  }

  function randomSlot(s: SlotDef) {
    const opt = s.options[Math.floor(Math.random() * s.options.length)];
    if (opt) pick(s.slot, opt.id);
  }

  function randomAll() {
    const next: Record<string, string> = {};
    for (const s of slots) {
      const opt = s.options[Math.floor(Math.random() * s.options.length)];
      if (opt) next[s.slot] = opt.id;
    }
    setSel(next);
    const sent = sentence(next, freeTexts);
    onChange(next, freeTexts, sent);
    speak(sent);
  }

  // Web Speech API 語音輸入（§4.2）：lang yue-Hant-HK fallback zh-HK
  function startVoice(s: SlotDef) {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition; SpeechRecognition?: new () => SpeechRecognition });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) { alert('呢部電腦唔支援語音，試下用手撳選項啦'); return; }
    const rec = new Rec();
    rec.lang = 'yue-Hant-HK';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(s.slot);
    rec.onresult = async (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setListening(null);
      if (!s.setName) { setFree(s.slot, transcript); return; }
      try {
        const r = await api<{ ids: string[] }>('/api/speech/match', { json: { transcript, setName: s.setName } });
        if (r.ids.includes('__HUMAN__')) { alert('呢度畫動物或者奇幻角色先啦 🐱🦄'); return; }
        const hints = r.ids.map((id) => s.options.find((o) => o.id === id)).filter(Boolean) as Option[];
        if (hints.length) setVoiceHints({ ...voiceHints, [s.slot]: hints });
        else setFree(s.slot, transcript);
      } catch { setFree(s.slot, transcript); }
    };
    rec.onerror = () => setListening(null);
    rec.onend = () => setListening(null);
    rec.start();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button className="btn accent2" onClick={randomAll}>🎲 全部隨機</button>
      {slots.map((s) => (
        <section key={s.slot} aria-label={s.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 22 }}>{s.label}</h3>
            <button className="btn secondary" style={{ minHeight: 44, padding: '0 14px' }} onClick={() => randomSlot(s)}>🎲</button>
            <button className="btn secondary" style={{ minHeight: 44, padding: '0 14px', background: listening === s.slot ? 'var(--color-accent)' : undefined, color: listening === s.slot ? '#fff' : undefined }}
              onClick={() => startVoice(s)}>🎤{listening === s.slot ? '…聽緊' : ''}</button>
          </div>

          {voiceHints[s.slot]?.length ? (
            <div style={{ marginBottom: 10, padding: 10, background: '#fff6fb', borderRadius: 12 }}>
              <div style={{ color: 'var(--color-muted)' }}>你係咪想講…</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {voiceHints[s.slot].map((o) => (
                  <button key={o.id} className="btn" style={{ minHeight: 48 }} onClick={() => { pick(s.slot, o.id); setVoiceHints({ ...voiceHints, [s.slot]: [] }); }}>{o.icon} {o.labelZh}</button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid-cards" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${perPage === 4 ? 160 : 130}px, 1fr))` }}>
            {s.options.map((o) => (
              <button key={o.id} onClick={() => pick(s.slot, o.id)}
                style={{
                  border: 'none', borderRadius: 18, padding: '18px 10px', background: sel[s.slot] === o.id ? 'var(--color-accent)' : '#fff',
                  color: sel[s.slot] === o.id ? '#fff' : 'var(--color-ink)', boxShadow: sel[s.slot] === o.id ? 'var(--shadow)' : 'var(--shadow-sm)',
                  cursor: 'pointer', minHeight: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'transform .2s',
                }}>
                <span style={{ fontSize: 40 }}>{o.icon ?? '✨'}</span>
                <span style={{ fontWeight: 700 }}>{o.labelZh}</span>
              </button>
            ))}
            {/* 自己講／自己打（§4.2） */}
            <div style={{ borderRadius: 18, padding: 12, background: sel[s.slot] === '__FREE__' ? '#fff0f6' : '#fff', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
              <div style={{ fontSize: 30, textAlign: 'center' }}>✏️</div>
              <input className="field" style={{ minHeight: 44, fontSize: 16 }} maxLength={40} placeholder="自己講／自己打"
                value={freeTexts[s.slot] ?? ''} onChange={(e) => setFree(s.slot, e.target.value)} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
