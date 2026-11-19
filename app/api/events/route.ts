// SSE（§6.2 / §8）：訂閱 job 狀態或班別作品牆。經 Cloudflare 每 25 秒送 heartbeat。
import { NextRequest } from 'next/server';
import { newRedis } from '@/lib/redis';
import { EVENTS_CHANNEL, PlatformEvent } from '@/lib/events';
import { requireStudent, requireStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const student = await requireStudent();
  const staff = !student ? await requireStaff() : null;
  if (!student && !staff) return new Response('unauthorized', { status: 401 });

  const sp = req.nextUrl.searchParams;
  const jobId = sp.get('jobId');
  const classId = sp.get('classId');
  const lessonId = sp.get('lessonId');

  const encoder = new TextEncoder();
  const sub = newRedis();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: string) => {
        if (!closed) controller.enqueue(encoder.encode(data));
      };
      send(`retry: 3000\n\n`);

      const heartbeat = setInterval(() => send(`: ping\n\n`), 25000);

      await sub.subscribe(EVENTS_CHANNEL);
      sub.on('message', (_ch, raw) => {
        let ev: PlatformEvent;
        try { ev = JSON.parse(raw); } catch { return; }
        if (jobId && ev.type === 'job' && ev.jobId === jobId) {
          send(`event: job\ndata: ${raw}\n\n`);
        } else if (classId && 'classId' in ev && ev.classId === classId) {
          if (lessonId && 'lessonId' in ev && ev.lessonId && ev.lessonId !== lessonId) return;
          send(`event: ${ev.type}\ndata: ${raw}\n\n`);
        }
      });

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        sub.quit().catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
