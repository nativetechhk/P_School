'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<'u' | 'p'>('u');

  // QR 派發卡自動填入（§2）：?u=&p=
  useEffect(() => {
    const u = sp.get('u'); const p = sp.get('p');
    if (u) setUsername(u);
    if (p) { setPassword(p); setFocus('p'); }
  }, [sp]);

  async function submit() {
    if (!username || !password) { setErr('請輸入帳號同密碼'); return; }
    setBusy(true); setErr('');
    try {
      await api('/api/auth/student-login', { json: { username, password } });
      router.push('/home');
    } catch (e) {
      setErr((e as Error).message || '登入失敗');
      setBusy(false);
    }
  }

  function tap(key: string) {
    const setter = focus === 'u' ? setUsername : setPassword;
    const cur = focus === 'u' ? username : password;
    if (key === 'del') setter(cur.slice(0, -1));
    else if (cur.length < 12) setter(cur + key);
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'linear-gradient(160deg,#e3f0ff,#ffe0ec)' }}>
      <div className="card" style={{ width: 'min(440px, 100%)', textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>🎨</div>
        <h1 style={{ fontSize: 32 }}>學生登入</h1>

        <label style={{ textAlign: 'left', display: 'block', marginTop: 16 }}>
          <div style={{ color: 'var(--color-muted)', marginBottom: 6 }}>帳號</div>
          <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} onFocus={() => setFocus('u')}
            style={{ borderColor: focus === 'u' ? 'var(--color-accent-2)' : undefined }} placeholder="例如 S4-07" autoCapitalize="characters" />
        </label>
        <label style={{ textAlign: 'left', display: 'block', marginTop: 12 }}>
          <div style={{ color: 'var(--color-muted)', marginBottom: 6 }}>密碼</div>
          <input className="field" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocus('p')}
            style={{ borderColor: focus === 'p' ? 'var(--color-accent-2)' : undefined, letterSpacing: 6 }} inputMode="numeric" type="password" placeholder="6 位數字" />
        </label>

        {/* 數字鍵盤 UI（§2） */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 18 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} className="btn secondary" style={{ fontSize: 26 }} onClick={() => tap(k)}>{k}</button>
          ))}
          <button className="btn secondary" onClick={() => tap('del')}>⌫</button>
          <button className="btn secondary" style={{ fontSize: 26 }} onClick={() => tap('0')}>0</button>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? '…' : '✓'}</button>
        </div>

        {err && <div style={{ color: 'var(--color-danger)', marginTop: 14, fontWeight: 700 }}>{err}</div>}
        <button className="btn lg" style={{ marginTop: 16, width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? '登入中…' : '開始啦！🚀'}
        </button>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense><LoginForm /></Suspense>;
}
