// POST /api/text-task {lessonId, task, input} → {result}（senior-l6 縮寫劇本 / junior-l6 潤飾三句）
import { NextRequest, NextResponse } from 'next/server';
import { requireStudent, unauthorized } from '@/lib/session';
import { getLessonTemplate } from '@/lib/prompt-engine';
import { generateText } from '@/lib/gemini';
import { checkStudentText } from '@/lib/safety';

export async function POST(req: NextRequest) {
  const student = await requireStudent();
  if (!student) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const lessonId = String(body.lessonId ?? '');
  const taskKey = String(body.task ?? '');
  const input = String(body.input ?? '').slice(0, 2000);

  const safety = await checkStudentText(input);
  if (!safety.ok && safety.action === 'block') {
    return NextResponse.json({ ok: false, error: safety.message }, { status: 422 });
  }

  const template = await getLessonTemplate(lessonId);
  const textTasks = (template?.data as { textTasks?: Record<string, { enabled: boolean; model: string; template: string }> })?.textTasks;
  const task = textTasks?.[taskKey];
  if (!task || !task.enabled) return NextResponse.json({ ok: false, error: '此功能未開放' }, { status: 403 });

  const prompt = task.template
    .replaceAll('{SCRIPT}', input)
    .replaceAll('{THREE_SENTENCES}', input);
  const raw = await generateText(task.model, prompt);

  // 嘗試解析 JSON（劇本縮寫）
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw.replace(/```json?|```/g, '').trim()); } catch { /* plain text */ }
  return NextResponse.json({ ok: true, result: parsed ?? raw, raw });
}
