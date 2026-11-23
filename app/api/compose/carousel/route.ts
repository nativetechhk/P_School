// POST /api/compose/carousel {title, slides:[{artifactId, caption}], reflection?[]} → {artifactId}
// 第 6 節：把選定作品打包成自包含 HTML 輪播（§5.1）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStudent, unauthorized } from '@/lib/session';
import { buildCarouselHtml, CarouselSlide } from '@/lib/carousel';
import { imageDataUri } from '@/lib/export';
import { storage } from '@/lib/storage';
import { getOptionSet } from '@/lib/prompt-engine';
import { lessonById } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const slidesIn: { artifactId: string; caption?: string }[] = Array.isArray(body.slides) ? body.slides : [];
  if (slidesIn.length < 1) return NextResponse.json({ ok: false, error: '請至少揀一件作品' }, { status: 400 });

  const stu = await prisma.student.findUniqueOrThrow({ where: { id: student.id! }, include: { class: true } });
  const masters = await getOptionSet('masters');
  const painterById = new Map(masters.map((m) => [m.itemId, m.labelZh]));

  const slides: CarouselSlide[] = [];
  const sourceIds: string[] = [];
  for (const s of slidesIn) {
    const a = await prisma.artifact.findUnique({ where: { id: String(s.artifactId) } });
    if (!a || a.studentId !== student.id || a.type !== 'image') continue;
    const uri = await imageDataUri(a.filePath).catch(() => '');
    if (!uri) continue;
    const params = (a.params ?? {}) as { styleId?: string; palette?: { hex: string }[] };
    slides.push({
      imgDataUri: uri,
      lessonName: lessonById(a.lessonId)?.title ?? a.lessonId,
      promptZh: a.promptZh ?? undefined,
      caption: String(s.caption ?? '').slice(0, 60),
      painterLabel: params.styleId ? painterById.get(params.styleId) ?? undefined : undefined,
      paletteHex: params.palette?.map((c) => c.hex),
      date: a.createdAt.toLocaleDateString('zh-HK'),
    });
    sourceIds.push(a.id);
  }
  if (!slides.length) return NextResponse.json({ ok: false, error: '搵唔到可用作品' }, { status: 404 });

  const reflection = (Array.isArray(body.reflection) ? body.reflection : []).map((r: unknown) => String(r).slice(0, 60)).filter(Boolean);
  const html = buildCarouselHtml({
    title: String(body.title ?? '').slice(0, 40),
    cover: { who: stu.nickname || stu.username, className: stu.class.name, courseName: '小小 AI 探索家' },
    slides, reflection,
  });

  const lessonId = String(body.lessonId ?? (stu.group === 'senior' ? 'senior-l6-carousel' : 'junior-l6-carousel'));
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const filePath = `artifacts/${stu.classId}/${lessonId}/${stu.id}/${id}.html`;
  await storage.save(filePath, Buffer.from(html, 'utf8'));

  const artifact = await prisma.artifact.create({
    data: {
      studentId: stu.id, classId: stu.classId, lessonId, role: 'carousel', type: 'html',
      promptZh: String(body.title ?? '我的作品輪播'), sourceArtifactIds: sourceIds, filePath, status: 'ok',
      params: { reflection, slideCount: slides.length } as object,
    },
  });
  if (reflection.length) {
    await prisma.setting.upsert({ where: { key: `three_sentences:${stu.id}` }, update: { value: reflection }, create: { key: `three_sentences:${stu.id}`, value: reflection } });
  }
  return NextResponse.json({ ok: true, artifactId: artifact.id });
}
