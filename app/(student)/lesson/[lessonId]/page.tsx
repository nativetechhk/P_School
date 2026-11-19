import { notFound } from 'next/navigation';
import { lessonById } from '@/lib/config';
import { getLessonContent } from '@/lib/lesson-content';
import LessonClient from './LessonClient';

export default function LessonPage({ params }: { params: { lessonId: string } }) {
  const def = lessonById(params.lessonId);
  if (!def) notFound();
  const content = getLessonContent(params.lessonId);
  return <LessonClient lessonId={params.lessonId} content={content} />;
}
