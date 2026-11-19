'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import TopNav, { LessonTab } from '@/components/student/TopNav';
import StepCards from '@/components/student/StepCards';
import { GenerateWorkspace, EditWorkspace, PaletteWorkspace, LessonMeta } from '@/components/student/workspaces';
import { PosterWorkspace, StorybookWorkspace } from '@/components/student/compose-workspaces';
import type { LessonContent } from '@/lib/lesson-content';
import { Artifact } from '@/components/student/PriorWorksPicker';

interface LessonApi extends LessonMeta { optionSetsRaw: Record<string, string>; enabled: boolean }

export default function LessonClient({ lessonId, content }: { lessonId: string; content: LessonContent | null }) {
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [works, setWorks] = useState<Artifact[]>([]);

  const meta = lessons.find((l) => l.id === lessonId);
  const tabs: LessonTab[] = lessons.map((l) => ({ id: l.id, title: l.title, lessonNo: l.lessonNo }));

  useEffect(() => {
    api<{ lessons: LessonApi[] }>('/api/lessons')
      .then((r) => setLessons(r.lessons))
      .catch((e) => { if ((e as { status?: number }).status === 401) router.push('/login'); })
      .finally(() => setLoading(false));
    api<{ artifacts: Artifact[] }>(`/api/artifacts?lessonId=${lessonId}`).then((r) => setWorks(r.artifacts)).catch(() => {});
  }, [lessonId, router]);

  function renderWorkspace() {
    if (!meta) return null;
    const raw = meta.optionSetsRaw ?? {};
    switch (meta.kind) {
      case 'generate': return <GenerateWorkspace meta={meta} optionSetsRaw={raw} />;
      case 'edit': return <EditWorkspace meta={meta} optionSetsRaw={raw} />;
      case 'vision': return <PaletteWorkspace meta={meta} />;
      case 'compose':
        return meta.group === 'senior' ? <StorybookWorkspace meta={meta} /> : <PosterWorkspace meta={meta} />;
      default: return <div>未支援嘅課堂類型</div>;
    }
  }

  if (loading) return <main style={{ padding: 40 }}><div className="spin" /></main>;
  if (!meta) {
    return (
      <>
        <TopNav tabs={tabs} activeId={lessonId} />
        <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
          <div className="card" style={{ textAlign: 'center', fontSize: 22 }}>呢節未開放，揀第二節啦 😊</div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav tabs={tabs} activeId={lessonId} />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <h1 style={{ fontSize: 30 }}>第 {meta.lessonNo} 節 · {meta.title}</h1>
        {content && <StepCards content={content} />}

        <section aria-label="練習區">
          <h2 style={{ fontSize: 26 }}>✏️ 練習區</h2>
          {renderWorkspace()}
        </section>

        <section aria-label="本節作品">
          <h2 style={{ fontSize: 26 }}>🖼️ 本節作品</h2>
          {works.length === 0 ? (
            <div style={{ color: 'var(--color-muted)' }}>仲未有作品，試下上面嘅練習區啦！</div>
          ) : (
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
              {works.map((a) => (
                <div key={a.id} className="card" style={{ padding: 8 }}>
                  <img src={a.thumbUrl ?? a.url} alt={a.promptZh} style={{ borderRadius: 10, aspectRatio: '1', objectFit: 'cover' }} />
                  {(a.teacherHeart ?? 0) > 0 && <div>{'❤'.repeat(a.teacherHeart ?? 0)}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
