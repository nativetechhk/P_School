// POST /api/upload (multipart) → 學生上載第 2 節 PNG（junior-l4 pet_original），去 EXIF
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireStudent, unauthorized } from '@/lib/session';
import { saveImageArtifact } from '@/lib/artifacts';

export const dynamic = 'force-dynamic';
const MAX = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const form = await req.formData();
  const file = form.get('file');
  const role = String(form.get('role') ?? 'pet_original');
  const lessonId = String(form.get('lessonId') ?? 'junior-l4-generate-style');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: '請揀一個檔案' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, error: '圖片太大（上限 5MB）' }, { status: 413 });

  const input = Buffer.from(await file.arrayBuffer());
  // 去 EXIF（§7 私隱）+ 轉 PNG
  const png = await sharp(input).rotate().png().toBuffer();

  const artifact = await saveImageArtifact({
    studentId: student.id!, classId: student.classId!, lessonId, role, png,
    promptZh: '我上載嘅寵物圖', notify: false,
  });
  return NextResponse.json({ ok: true, artifactId: artifact.id });
}
