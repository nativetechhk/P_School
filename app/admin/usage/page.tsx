'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface Usage {
  today: { images: number; edits: number; visionCalls: number; estCostUsd: number };
  week: { date: string; images: number; edits: number; cost: number }[];
  queue: { queued: number; active: number; done24: number; failed24: number; errorRate: number };
  rpm: { used: number; limit: number };
  health: { redis: boolean; db: boolean; mockAi: boolean };
  settings: { costPerImageUsd: number; dailyCapGlobal: number };
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160 }}>
      <div style={{ color: 'var(--color-muted)' }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function UsagePage() {
  const [u, setU] = useState<Usage | null>(null);
  const [warming, setWarming] = useState(false);

  async function load() { setU(await api<Usage>('/api/admin/usage')); }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  async function warmup() {
    setWarming(true);
    try { await api('/api/admin/prompts/test-generate', { json: { lessonId: 'senior-l3-character', slots: { A: 's_dragon', B: 'e_skycity', C: 'd_rainbow', D: 'style_cartoon' } } }); }
    catch { /* */ }
    setWarming(false); load();
  }

  if (!u) return <div className="spin" />;
  return (
    <div>
      <h1>📊 用量</h1>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="今日生成" value={u.today.images + u.today.edits} sub={`${u.today.images} 生圖 + ${u.today.edits} 編輯`} />
        <Stat label="今日估算費用" value={`$${u.today.estCostUsd.toFixed(2)}`} sub={`每張 $${u.settings.costPerImageUsd}`} />
        <Stat label="佇列" value={`${u.queue.queued} 等 / ${u.queue.active} 做`} sub={`24h 完成 ${u.queue.done24}`} />
        <Stat label="RPM 使用" value={`${u.rpm.used} / ${u.rpm.limit}`} sub="即時（本分鐘）" />
        <Stat label="API 錯誤率" value={`${(u.queue.errorRate * 100).toFixed(0)}%`} sub={`24h 失敗 ${u.queue.failed24}`} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>連線健康</h3>
        <div style={{ display: 'flex', gap: 20, fontSize: 18 }}>
          <span>{u.health.db ? '✅' : '❌'} Postgres</span>
          <span>{u.health.redis ? '✅' : '❌'} Redis</span>
          <span>{u.health.mockAi ? '🧪 MOCK 模式（未設 GEMINI_API_KEY）' : '✅ Gemini'}</span>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={warmup} disabled={warming}>{warming ? '預熱中…' : '🔥 預熱（送測試請求）'}</button>
      </div>

      <div className="card">
        <h3>近 7 日</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--color-muted)' }}><th>日期</th><th>生圖</th><th>編輯</th><th>費用</th></tr></thead>
          <tbody>
            {u.week.map((w) => (
              <tr key={w.date} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '8px 0' }}>{w.date}</td><td>{w.images}</td><td>{w.edits}</td><td>${w.cost.toFixed(2)}</td>
              </tr>
            ))}
            {!u.week.length && <tr><td colSpan={4} style={{ padding: 16, color: 'var(--color-muted)' }}>暫無資料</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
