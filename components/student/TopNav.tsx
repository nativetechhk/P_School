'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export interface LessonTab { id: string; title: string; lessonNo: number }

export default function TopNav({ tabs, activeId }: { tabs: LessonTab[]; activeId?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await api('/api/auth/logout', { json: {} });
    router.push('/login');
  }

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fffdf9ee', backdropFilter: 'blur(8px)', boxShadow: 'var(--shadow-sm)' }}>
      <nav aria-label="課堂導航" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', flexWrap: 'wrap' }}>
        <Link href="/home" style={{ fontWeight: 800, fontSize: 22, textDecoration: 'none', color: 'var(--color-ink)' }}>🎨</Link>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1 }}>
          {tabs.map((t) => {
            const active = activeId === t.id || pathname.includes(t.id);
            return (
              <Link key={t.id} href={`/lesson/${t.id}`}
                style={{
                  padding: '12px 20px', borderRadius: 14, whiteSpace: 'nowrap', textDecoration: 'none', fontWeight: 700,
                  background: active ? 'var(--color-accent)' : '#fff', color: active ? '#fff' : 'var(--color-ink)',
                  boxShadow: active ? 'var(--shadow)' : 'inset 0 0 0 2px #eee', minHeight: 48, display: 'inline-flex', alignItems: 'center',
                }}>
                第 {t.lessonNo} 節 · {t.title}
              </Link>
            );
          })}
        </div>
        <Link href="/my-works" className="btn secondary" style={{ minHeight: 48 }}>我的作品</Link>
        <button className="btn ghost" style={{ minHeight: 48 }} onClick={logout}>登出</button>
      </nav>
    </header>
  );
}
