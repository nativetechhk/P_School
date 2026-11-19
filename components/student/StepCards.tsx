'use client';

interface Content {
  title: string;
  worksheetRef: string;
  steps: { text: string; worksheetQ?: string }[];
  tips: string[];
}

// 今日做咩？步驟卡（§4.1 / §5.3）
export default function StepCards({ content }: { content: Content }) {
  return (
    <section aria-label="今日做咩" className="card" style={{ background: 'linear-gradient(160deg,#fff7e6,#e3f0ff)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 28, margin: 0 }}>📋 今日做咩？</h2>
        <span style={{ color: 'var(--color-muted)' }}>{content.worksheetRef}</span>
      </div>
      <ol style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        {content.steps.map((s, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{i + 1}</span>
            <span style={{ fontSize: 19 }}>{s.text}{s.worksheetQ && <em style={{ color: 'var(--color-muted)', marginLeft: 8, fontStyle: 'normal' }}>（{s.worksheetQ}）</em>}</span>
          </li>
        ))}
      </ol>
      {content.tips.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 17, color: 'var(--color-muted)' }}>
          💡 {content.tips.join('　•　')}
        </div>
      )}
    </section>
  );
}
