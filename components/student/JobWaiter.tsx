'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';

interface Props {
  jobId: string;
  onDone: (artifactIds: string[]) => void;
  onFail?: (err: string) => void;
}

// SSE 訂閱 job 狀態，失敗則退回 3 秒輪詢（§6.2 / §8）
export default function JobWaiter({ jobId, onDone, onFail }: Props) {
  const [status, setStatus] = useState<'queued' | 'active' | 'done' | 'failed'>('queued');
  const [position, setPosition] = useState<number | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const handle = (s: string, pos?: number, ids?: string[], err?: string) => {
      if (finished.current) return;
      setStatus(s as 'queued' | 'active' | 'done' | 'failed');
      if (typeof pos === 'number') setPosition(pos);
      if (s === 'done' && ids) { finished.current = true; onDone(ids); }
      if (s === 'failed') { finished.current = true; onFail?.(err || 'AI 太忙，等一陣再試'); }
    };

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(async () => {
        try {
          const r = await api<{ status: string; position: number; artifactIds: string[]; error?: string }>(`/api/jobs/${jobId}`);
          handle(r.status, r.position, r.artifactIds, r.error);
          if (r.status === 'done' || r.status === 'failed') { if (poll) clearInterval(poll); }
        } catch { /* keep polling */ }
      }, 3000);
    };

    try {
      es = new EventSource(`/api/events?jobId=${jobId}`);
      es.addEventListener('job', (ev) => {
        const d = JSON.parse((ev as MessageEvent).data);
        handle(d.status, d.position, d.artifactIds, d.error);
      });
      es.onerror = () => { es?.close(); startPolling(); };
    } catch {
      startPolling();
    }
    // 保險：也開一條慢輪詢，避免 SSE 靜默
    const safety = setInterval(async () => {
      if (finished.current) { clearInterval(safety); return; }
      try {
        const r = await api<{ status: string; position: number; artifactIds: string[]; error?: string }>(`/api/jobs/${jobId}`);
        handle(r.status, r.position, r.artifactIds, r.error);
      } catch { /* */ }
    }, 5000);

    return () => { es?.close(); if (poll) clearInterval(poll); clearInterval(safety); finished.current = true; };
  }, [jobId, onDone, onFail]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24 }}>
      <div className="spin" />
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {status === 'queued' && (position && position > 0 ? `排緊隊… 前面仲有 ${position} 位同學` : 'AI 準備緊…')}
        {status === 'active' && '🎨 AI 畫緊你嘅作品…'}
        {status === 'done' && '完成！'}
        {status === 'failed' && '😢 AI 太忙，等一陣再試'}
      </div>
    </div>
  );
}
