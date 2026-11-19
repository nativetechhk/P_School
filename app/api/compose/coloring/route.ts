// POST /api/compose/coloring {dataUrl, paletteArtifactId?} → {artifactId}（junior-l5 SVG 填色器輸出 PNG）
import { NextRequest, NextResponse } from 'next/server';
import { requireStudent, unauthorized } from '@/lib/session';
import { saveImageArtifact } from '@/lib/artifacts';

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const dataUrl = String(body.dataUrl ?? '');
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!m) return NextResponse.json({ ok: false, error: '圖片格式錯誤' }, { status: 400 });
  const png = Buffer.from(m[1], 'base64');
  if (png.length > 8 * 1024 * 1024) return NextResponse.json({ ok: false, error: '圖片太大' }, { status: 413 });

  const artifact = await saveImageArtifact({
    studentId: student.id!, classId: student.classId!, lessonId: 'junior-l5-palette',
    role: 'coloring', png, promptZh: '我填色嘅名畫',
    sourceArtifactIds: body.paletteArtifactId ? [String(body.paletteArtifactId)] : [],
  });
  return NextResponse.json({ ok: true, artifactId: artifact.id });
}
