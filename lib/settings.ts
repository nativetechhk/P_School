import { prisma } from './db';
import { DEFAULT_SETTINGS, Settings } from './config';

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...map } as Settings;
}

export async function setSetting(key: string, value: unknown) {
  await prisma.setting.upsert({
    where: { key },
    update: { value: value as object },
    create: { key, value: value as object },
  });
}
