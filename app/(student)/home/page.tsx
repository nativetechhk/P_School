'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/client';
import TopNav, { LessonTab } from '@/components/student/TopNav';

interface Lesson { id: string; title: string; lessonNo: number; quota?: { lessonRemaining: number; lessonQuota: number } }

export default function HomePage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ lessons: Lesson[] }>('/api/lessons')
      .then((r) => setLessons(r.lessons))
      .catch((e) => { if ((e as { status?: number }).status === 401) router.push('/login'); })
      .finally(() => setLoading(false));
  }, [router]);

  const tabs: LessonTab[] = lessons.map((l) => ({ id: l.id, title: l.title, lessonNo: l.lessonNo }));

  return (
    <>
      <TopNav tabs={tabs} />
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 34 }}>👋 揀一節開始啦！</h1>
        {loading && <div className="spin" />}
        {!loading && !lessons.length && (
          <div className="card" style={{ textAlign: 'center', fontSize: 22 }}>導師仲未開放課堂，等陣先 😊</div>
        )}
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', marginTop: 20 }}>
          {lessons.map((l) => (
            <Link key={l.id} href={`/lesson/${l.id}`} className="card flyin" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 48 }}>{['🎭', '🏞️', '🎨', '📖'][l.lessonNo - 3] ?? '✨'}</div>
              <div style={{ fontWeight: 800, fontSize: 24 }}>第 {l.lessonNo} 節</div>
              <div style={{ fontSize: 20 }}>{l.title}</div>
              {l.quota && <div style={{ color: 'var(--color-muted)' }}>仲可以畫 {l.quota.lessonRemaining} 次</div>}
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
