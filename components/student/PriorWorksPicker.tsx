'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export interface Artifact {
  id: string; role: string; lessonId: string; promptZh?: string;
  thumbUrl?: string | null; url: string;
  favorite?: boolean; teacherHeart?: number; teacherNote?: string; createdAt?: string;
  params?: unknown;
}

interface Props {
  roles: string[];
  multi?: boolean;
  max?: number;
  onSelect: (artifacts: Artifact[]) => void;
  demoFallback?: boolean;
}

// 承接面板（§5.0）：列出前幾節 status=ok 作品；缺席者用示範作品
export default function PriorWorksPicker({ roles, multi, max = 4, onSelect, demoFallback }: Props) {
  const [items, setItems] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ artifacts: Artifact[] }>(`/api/artifacts?roles=${roles.join(',')}`)
      .then((r) => setItems(r.artifacts))
      .finally(() => setLoading(false));
  }, [roles]);

  function toggle(a: Artifact) {
    let next: string[];
    if (multi) {
      next = selected.includes(a.id) ? selected.filter((x) => x !== a.id) : [...selected, a.id].slice(0, max);
    } else {
      next = [a.id];
    }
    setSelected(next);
    onSelect(items.filter((it) => next.includes(it.id)));
  }

  if (loading) return <div className="spin" />;

  if (!items.length) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p>你前幾節未有作品喎。</p>
        {demoFallback && (
          <button className="btn" onClick={() => onSelect([{ id: '__demo__', role: roles[0], lessonId: '', url: '/demo-asset.png', thumbUrl: '/demo-asset.png' }])}>
            🖼️ 用示範作品
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid-cards">
        {items.map((a) => (
          <button key={a.id} onClick={() => toggle(a)}
            style={{ border: selected.includes(a.id) ? '4px solid var(--color-accent)' : '4px solid transparent', borderRadius: 16, padding: 0, background: '#fff', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <img src={a.thumbUrl ?? a.url} alt={a.promptZh ?? a.role} style={{ aspectRatio: '1', objectFit: 'cover', width: '100%' }} />
            <div style={{ fontSize: 13, padding: 4, color: 'var(--color-muted)' }}>{a.lessonId.replace(/^.*-l/, '第').replace('-', ' ')}</div>
          </button>
        ))}
      </div>
      {multi && <p style={{ color: 'var(--color-muted)', marginTop: 8 }}>已揀 {selected.length} / {max}</p>}
    </div>
  );
}
