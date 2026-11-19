'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';

const NAV = [
  { href: '/admin/classes', label: '班別', icon: '🏫' },
  { href: '/admin/accounts', label: '帳號 + 派發卡', icon: '🎟️' },
  { href: '/admin/lessons', label: '課堂開關／配額', icon: '🔓' },
  { href: '/admin/prompts', label: 'Prompt 引擎', icon: '🧩' },
  { href: '/admin/blacklist', label: '黑名單', icon: '🚫' },
  { href: '/admin/works', label: '作品牆／審核', icon: '🖼️' },
  { href: '/admin/settings', label: '設定', icon: '⚙️' },
  { href: '/admin/exports', label: '匯出／完成作', icon: '📦' },
  { href: '/admin/data', label: '資料管理', icon: '🗑️' },
  { href: '/admin/usage', label: '用量', icon: '📊' },
  { href: '/present', label: '投影模式', icon: '📽️' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() { await api('/api/auth/logout', { json: {} }); router.push('/admin/login'); }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 230, flexShrink: 0, background: '#231d33', color: '#fff', padding: 16, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>🎨 後台</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/present' && pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} target={n.href === '/present' ? '_blank' : undefined}
                style={{ padding: '12px 14px', borderRadius: 10, textDecoration: 'none', color: active ? '#fff' : '#bdb5cc', background: active ? 'var(--color-accent-2)' : 'transparent', fontWeight: active ? 700 : 500 }}>
                {n.icon} {n.label}
              </Link>
            );
          })}
        </nav>
        <button className="btn ghost" style={{ color: '#bdb5cc', marginTop: 20 }} onClick={logout}>登出</button>
      </aside>
      <main style={{ flex: 1, padding: 28, background: '#f6f4fa', minWidth: 0 }}>{children}</main>
    </div>
  );
}
