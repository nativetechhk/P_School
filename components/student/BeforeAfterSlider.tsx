'use client';

import { useState } from 'react';

// 前／後對照滑桿（§5.1 l5 / junior-l4）
export default function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow)', aspectRatio: '1' }}>
        <img src={before} alt="轉換前" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} />
        <div style={{ position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden' }}>
          <img src={after} alt="轉換後" style={{ width: `${10000 / pos}%`, maxWidth: 'none', height: '100%', objectFit: 'contain', background: '#fff' }} />
        </div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 3, background: '#fff', boxShadow: '0 0 6px rgba(0,0,0,.4)' }} />
        <span style={{ position: 'absolute', left: 10, top: 10, background: '#0008', color: '#fff', padding: '4px 10px', borderRadius: 10 }}>前</span>
        <span style={{ position: 'absolute', right: 10, top: 10, background: '#0008', color: '#fff', padding: '4px 10px', borderRadius: 10 }}>後</span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} style={{ width: '100%', marginTop: 12, height: 40 }} />
    </div>
  );
}
