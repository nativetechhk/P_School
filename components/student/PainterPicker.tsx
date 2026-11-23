'use client';

import { useState } from 'react';

export interface Painter {
  id: string; icon?: string; labelZh: string;
  blurb?: string | null; en?: string | null; deathYear?: number | null;
  famousWorks?: { zh: string; year?: number }[] | null;
}

interface Props {
  painters: Painter[];
  value?: string | null;
  onSelect: (id: string) => void;
}

// 畫家揀選卡：hover（或點 ⓘ）顯示代表作參考 + 一鍵睇真跡（§5.4）
export default function PainterPicker({ painters, value, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  function searchUrl(p: Painter): string {
    const q = `${p.en || p.labelZh} 名畫 代表作`;
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
  }

  return (
    <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {painters.map((p) => {
        const active = value === p.id;
        const showTip = hover === p.id;
        return (
          <div key={p.id} style={{ position: 'relative' }}
            onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}>
            <button onClick={() => onSelect(p.id)}
              style={{
                width: '100%', border: active ? '4px solid var(--color-accent)' : '4px solid transparent', borderRadius: 18,
                padding: '16px 10px', background: '#fff', cursor: 'pointer', boxShadow: active ? 'var(--shadow)' : 'var(--shadow-sm)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minHeight: 120,
              }}>
              <span style={{ fontSize: 40 }}>{p.icon ?? '🎨'}</span>
              <span style={{ fontWeight: 800, fontSize: 19 }}>{p.labelZh}</span>
              {p.blurb && <span style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.3 }}>{p.blurb}</span>}
              <span
                onClick={(e) => { e.stopPropagation(); setHover(showTip ? null : p.id); }}
                style={{ position: 'absolute', top: 6, right: 8, fontSize: 18, color: 'var(--color-accent-2)' }}
                aria-label="睇代表作">ⓘ</span>
            </button>

            {showTip && (
              <div role="tooltip" onMouseLeave={() => setHover(null)}
                style={{
                  position: 'absolute', zIndex: 30, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6,
                  width: 240, background: '#231d33', color: '#fff', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-lg)',
                }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{p.icon} {p.labelZh} {p.en ? `· ${p.en}` : ''}</div>
                {p.deathYear === null && <div style={{ fontSize: 12, color: '#ffd54f' }}>在世藝術家</div>}
                {p.blurb && <div style={{ fontSize: 14, opacity: 0.85, margin: '6px 0' }}>{p.blurb}</div>}
                {p.famousWorks?.length ? (
                  <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                    <div style={{ opacity: 0.6, fontSize: 12 }}>著名畫作：</div>
                    {p.famousWorks.map((w, i) => <div key={i}>• {w.zh}{w.year ? `（${w.year}）` : ''}</div>)}
                  </div>
                ) : null}
                <a href={searchUrl(p)} target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'inline-block', marginTop: 10, color: '#fff', background: 'var(--color-accent)', padding: '8px 12px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                  🔍 撳一下睇真跡
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
