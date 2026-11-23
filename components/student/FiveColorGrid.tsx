'use client';

import { useState } from 'react';

export interface ColorItem { id: string; labelZh: string; hex: string }

interface Props {
  colors: ColorItem[];
  max?: number;
  onChange: (selected: ColorItem[]) => void;
}

// 14 色格，最多亮 5 個（第 6 個震動提示）（§5.1 FiveColorMode）
export default function FiveColorGrid({ colors, max = 5, onChange }: Props) {
  const [sel, setSel] = useState<string[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);

  function toggle(c: ColorItem) {
    if (sel.includes(c.id)) {
      const next = sel.filter((x) => x !== c.id);
      setSel(next); onChange(colors.filter((x) => next.includes(x.id)));
      return;
    }
    if (sel.length >= max) {
      setShakeId(c.id);
      if (navigator.vibrate) navigator.vibrate(120);
      setTimeout(() => setShakeId(null), 400);
      return;
    }
    const next = [...sel, c.id];
    setSel(next); onChange(colors.filter((x) => next.includes(x.id)));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>揀 {max} 隻色</span>
        <span style={{ color: sel.length === max ? 'var(--color-mint)' : 'var(--color-muted)', fontWeight: 700 }}>已揀 {sel.length} / {max}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
        {colors.map((c) => {
          const on = sel.includes(c.id);
          const order = sel.indexOf(c.id) + 1;
          return (
            <button key={c.id} onClick={() => toggle(c)} title={c.labelZh}
              style={{
                aspectRatio: '1', borderRadius: 14, background: c.hex, cursor: 'pointer', position: 'relative',
                border: on ? '4px solid var(--color-ink)' : '2px solid #ddd',
                transform: shakeId === c.id ? 'translateX(0)' : undefined,
                animation: shakeId === c.id ? 'cshake .4s' : undefined,
                boxShadow: on ? 'var(--shadow)' : 'none',
              }}>
              {on && <span style={{ position: 'absolute', top: 2, right: 4, background: '#000a', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 13, display: 'grid', placeItems: 'center' }}>{order}</span>}
              <span style={{ position: 'absolute', bottom: 2, left: 0, right: 0, fontSize: 12, color: ['#FAFAFA', '#FDD835'].includes(c.hex) ? '#333' : '#fff', textShadow: '0 1px 2px #0008' }}>{c.labelZh}</span>
            </button>
          );
        })}
      </div>
      <style>{`@keyframes cshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </div>
  );
}
