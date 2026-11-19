// 三層配額（§6.1）：每人每節 / 每帳號每日 / 冷卻；加全平台每日
import { prisma } from './db';
import { hkToday } from './config';
import { getSettings } from './settings';

export interface QuotaState {
  lessonQuota: number;
  lessonUsed: number;
  lessonRemaining: number;
  dailyCap: number;
  dailyUsed: number;
  cooldownSeconds: number;
  cooldownRemaining: number;
  canGenerate: boolean;
  reason?: string;
}

export async function getQuotaState(studentId: string, classId: string, lessonId: string): Promise<QuotaState> {
  const settings = await getSettings();
  const access = await prisma.lessonAccess.findUnique({
    where: { classId_lessonId: { classId, lessonId } },
  });
  const usage = await prisma.quotaUsage.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
  });
  const daily = await prisma.dailyUsage.findUnique({
    where: { studentId_date: { studentId, date: hkToday() } },
  });

  const lessonQuota = (access?.quotaPerStudent ?? 10) + (usage?.bonus ?? 0);
  const lessonUsed = usage?.used ?? 0;
  const cooldownSeconds = access?.cooldownSeconds ?? 60;
  const last = usage?.lastGeneratedAt?.getTime() ?? 0;
  const cooldownRemaining = Math.max(0, Math.ceil((last + cooldownSeconds * 1000 - Date.now()) / 1000));
  const dailyUsed = daily?.count ?? 0;

  let reason: string | undefined;
  if (!access?.enabled) reason = '本節未開放';
  else if (lessonUsed >= lessonQuota) reason = '本節配額用晒喇';
  else if (dailyUsed >= settings.dailyCapPerAccount) reason = '今日生成次數用晒喇';
  else if (cooldownRemaining > 0) reason = `等多 ${cooldownRemaining} 秒先可以再畫`;

  return {
    lessonQuota, lessonUsed, lessonRemaining: Math.max(0, lessonQuota - lessonUsed),
    dailyCap: settings.dailyCapPerAccount, dailyUsed,
    cooldownSeconds, cooldownRemaining,
    canGenerate: !reason, reason,
  };
}

export async function checkGlobalDailyCap(): Promise<boolean> {
  const settings = await getSettings();
  const row = await prisma.usageDaily.findUnique({ where: { date: hkToday() } });
  return ((row?.images ?? 0) + (row?.edits ?? 0)) < settings.dailyCapGlobal;
}

/** 消費 1 次配額（生成前呼叫） */
export async function consumeQuota(studentId: string, lessonId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.quotaUsage.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      update: { used: { increment: 1 }, lastGeneratedAt: now },
      create: { studentId, lessonId, used: 1, lastGeneratedAt: now },
    }),
    prisma.dailyUsage.upsert({
      where: { studentId_date: { studentId, date: hkToday() } },
      update: { count: { increment: 1 } },
      create: { studentId, date: hkToday(), count: 1 },
    }),
  ]);
}

/** 生成失敗退回配額（§6.2） */
export async function refundQuota(studentId: string, lessonId: string) {
  await prisma.$transaction([
    prisma.quotaUsage.update({
      where: { studentId_lessonId: { studentId, lessonId } },
      data: { used: { decrement: 1 } },
    }),
    prisma.dailyUsage.update({
      where: { studentId_date: { studentId, date: hkToday() } },
      data: { count: { decrement: 1 } },
    }),
  ]).catch(() => {});
}
