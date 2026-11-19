// 用量（§3.7）：今日/本週生成、估算費用、佇列狀態、配額用盡名單
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireStaff, unauthorized } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { hkToday } from '@/lib/config';
import { isMockAi, getGeminiKey, maskKey } from '@/lib/ai-key';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return unauthorized();
  const settings = await getSettings();
  const today = hkToday();

  const todayRow = await prisma.usageDaily.findUnique({ where: { date: today } });
  const week = await prisma.usageDaily.findMany({ orderBy: { date: 'desc' }, take: 7 });
  const queued = await prisma.job.count({ where: { status: 'queued' } });
  const active = await prisma.job.count({ where: { status: 'active' } });
  const failed24 = await prisma.job.count({ where: { status: 'failed', createdAt: { gte: new Date(Date.now() - 86400000) } } });
  const done24 = await prisma.job.count({ where: { status: 'done', createdAt: { gte: new Date(Date.now() - 86400000) } } });

  // 連線健康
  let redisOk = false, dbOk = false;
  try { await redis.ping(); redisOk = true; } catch { /* */ }
  try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { /* */ }

  // 即時 RPM 使用率（token bucket 計數）
  const rpmUsed = Number((await redis.get(`rpm:${Math.floor(Date.now() / 60000)}`)) ?? 0);

  return NextResponse.json({
    ok: true,
    today: {
      images: todayRow?.images ?? 0, edits: todayRow?.edits ?? 0,
      visionCalls: todayRow?.visionCalls ?? 0, estCostUsd: todayRow?.estCostUsd ?? 0,
    },
    week: week.map((w) => ({ date: w.date, images: w.images, edits: w.edits, cost: w.estCostUsd })),
    queue: { queued, active, done24, failed24, errorRate: done24 + failed24 ? failed24 / (done24 + failed24) : 0 },
    rpm: { used: rpmUsed, limit: settings.globalRpm },
    health: { redis: redisOk, db: dbOk, mockAi: await isMockAi(), geminiKey: maskKey(await getGeminiKey()) },
    settings: { costPerImageUsd: settings.costPerImageUsd, dailyCapGlobal: settings.dailyCapGlobal, dailyCapPerAccount: settings.dailyCapPerAccount },
    byStudent: await perStudentUsage(),
  });
}

/** 每個子帳號的用量（§3.7）：本節配額已用、今日次數、累計作品、已用盡課堂 */
async function perStudentUsage() {
  const today = hkToday();
  const [students, quotaRows, dailyRows, artifactRows] = await Promise.all([
    prisma.student.findMany({ include: { class: { select: { name: true } } }, orderBy: { username: 'asc' } }),
    prisma.quotaUsage.groupBy({ by: ['studentId'], _sum: { used: true } }),
    prisma.dailyUsage.findMany({ where: { date: today } }),
    prisma.artifact.groupBy({ by: ['studentId'], where: { status: 'ok', type: 'image' }, _count: { _all: true } }),
  ]);
  const quotaMap = new Map(quotaRows.map((r) => [r.studentId, r._sum.used ?? 0]));
  const dailyMap = new Map(dailyRows.map((r) => [r.studentId, r.count]));
  const artMap = new Map(artifactRows.map((r) => [r.studentId, r._count._all]));
  return students.map((s) => ({
    id: s.id, username: s.username, className: s.class.name, group: s.group, active: s.active,
    lessonUsedTotal: quotaMap.get(s.id) ?? 0,
    todayCount: dailyMap.get(s.id) ?? 0,
    artifacts: artMap.get(s.id) ?? 0,
  }));
}
