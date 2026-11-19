'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api('/api/auth/admin-login', { json: { email, password } });
      router.push('/admin/classes');
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#1a1626' }}>
      <form className="card" onSubmit={submit} style={{ width: 'min(400px,100%)' }}>
        <h1>🧑‍🏫 導師登入</h1>
        <input className="field" type="text" autoCapitalize="none" placeholder="帳號" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 12 }} />
        <input className="field" type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div style={{ color: 'var(--color-danger)', marginTop: 10 }}>{err}</div>}
        <button className="btn lg" style={{ marginTop: 16, width: '100%' }} disabled={busy}>{busy ? '…' : '登入'}</button>
      </form>
    </main>
  );
}
