'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/client';

// 簡化名畫線稿填色器（§5.2 junior-l5）：點色 → 點區域填色
const LINE_ARTS: { id: string; name: string; regions: { d: string }[] }[] = [
  {
    id: 'sunflower', name: '向日葵',
    regions: [
      { d: 'M100,100 m-40,0 a40,40 0 1,0 80,0 a40,40 0 1,0 -80,0' }, // center
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x = 100 + Math.cos(a) * 70, y = 100 + Math.sin(a) * 70;
        return { d: `M${x},${y} m-22,0 a22,30 0 1,0 44,0 a22,30 0 1,0 -44,0` };
      }),
      { d: 'M92,150 h16 v45 h-16 z' }, // stem
    ],
  },
  {
    id: 'starry', name: '星夜',
    regions: [
      { d: 'M0,0 h200 v120 h-200 z' }, { d: 'M0,120 h200 v80 h-200 z' },
      { d: 'M40,50 m-20,0 a20,20 0 1,0 40,0 a20,20 0 1,0 -40,0' },
      { d: 'M150,40 m-16,0 a16,16 0 1,0 32,0 a16,16 0 1,0 -32,0' },
    ],
  },
  {
    id: 'waterlily', name: '睡蓮',
    regions: [
      { d: 'M0,0 h200 v200 h-200 z' },
      { d: 'M70,90 m-35,0 a35,22 0 1,0 70,0 a35,22 0 1,0 -70,0' },
      { d: 'M130,130 m-28,0 a28,18 0 1,0 56,0 a28,18 0 1,0 -56,0' },
    ],
  },
];

export default function ColoringCanvas({ palette, paletteArtifactId }: { palette: string[]; paletteArtifactId?: string }) {
  const [artId, setArtId] = useState(LINE_ARTS[0].id);
  const [color, setColor] = useState(palette[0]);
  const [extra, setExtra] = useState('#ffffff');
  const [fills, setFills] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const art = LINE_ARTS.find((a) => a.id === artId)!;
  const allColors = [...palette, extra];

  async function save() {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
    await new Promise((r) => (img.onload = r));
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 400, 400);
    ctx.drawImage(img, 0, 0, 400, 400);
    await api('/api/compose/coloring', { json: { dataUrl: canvas.toDataURL('image/png'), paletteArtifactId } });
    setSaved(true);
  }

  return (
    <section className="card">
      <h3>🖌️ 名畫填色</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {LINE_ARTS.map((a) => (
          <button key={a.id} className="btn secondary" style={{ background: artId === a.id ? 'var(--color-accent)' : undefined, color: artId === a.id ? '#fff' : undefined }} onClick={() => { setArtId(a.id); setFills({}); }}>{a.name}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {allColors.map((c, i) => (
          <button key={i} onClick={() => setColor(c)} style={{ width: 48, height: 48, borderRadius: '50%', background: c, border: color === c ? '4px solid var(--color-ink)' : '2px solid #ddd', cursor: 'pointer' }} />
        ))}
        <input type="color" value={extra} onChange={(e) => { setExtra(e.target.value); setColor(e.target.value); }} style={{ width: 48, height: 48 }} title="加色" />
      </div>
      <svg ref={svgRef} viewBox="0 0 200 200" width={320} height={320} style={{ background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-sm)', touchAction: 'manipulation' }}>
        {art.regions.map((r, i) => (
          <path key={i} d={r.d} fill={fills[i] ?? '#f7f7f7'} stroke="#333" strokeWidth={2}
            style={{ cursor: 'pointer' }} onClick={() => setFills({ ...fills, [i]: color })} />
        ))}
      </svg>
      <div style={{ marginTop: 10 }}>
        <button className="btn" onClick={save}>💾 儲存我嘅畫</button>
        {saved && <span style={{ marginLeft: 10, color: 'var(--color-mint)' }}>已儲存 ✓</span>}
      </div>
    </section>
  );
}
