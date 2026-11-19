import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, background: 'linear-gradient(160deg,#fff3e0,#ffe0ec 50%,#e3f0ff)' }}>
      <div style={{ fontSize: 72 }}>🎨🦄🤖</div>
      <h1 style={{ fontSize: 44, textAlign: 'center' }}>小小 AI 探索家</h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 22 }}>一齊用 AI 畫出你嘅魔法世界！</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/login" className="btn lg">👦 我係學生</Link>
        <Link href="/admin/login" className="btn lg secondary">🧑‍🏫 導師入口</Link>
      </div>
    </main>
  );
}
