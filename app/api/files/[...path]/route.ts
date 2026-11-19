// signed-path 檔案下載（§8）
import { NextRequest, NextResponse } from 'next/server';
import { storage, verifySignedPath } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.json': 'application/json',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.svg': 'image/svg+xml',
};

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const relPath = decodeURIComponent(params.path.join('/'));
  const exp = req.nextUrl.searchParams.get('exp') ?? '';
  const sig = req.nextUrl.searchParams.get('sig') ?? '';
  if (!verifySignedPath(relPath, exp, sig)) {
    return NextResponse.json({ ok: false, error: '連結過期' }, { status: 403 });
  }
  try {
    const buf = await storage.read(relPath);
    const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase();
    const download = req.nextUrl.searchParams.get('dl');
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        ...(download ? { 'Content-Disposition': `attachment; filename="${encodeURIComponent(download)}"` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: '檔案不存在' }, { status: 404 });
  }
}
