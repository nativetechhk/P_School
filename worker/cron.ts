// 容器內排程（§8）：每日用量匯總、匯出檔 24 小時清理
import cron from 'node-cron';
import { readdir, stat, rm } from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/db';
import { hkToday } from '../lib/config';

const STORAGE = path.resolve(process.env.STORAGE_PATH || './data/uploads');

export function startCron() {
  // 每日 00:05（HK）確保當天 usage_daily 一列存在
  cron.schedule('5 0 * * *', async () => {
    const date = hkToday();
    await prisma.usageDaily.upsert({ where: { date }, update: {}, create: { date } }).catch(() => {});
    console.log(`[cron] usage rollup ${date}`);
  }, { timezone: 'Asia/Hong_Kong' });

  // 每小時清理 24 小時前的匯出檔（exports/*）
  cron.schedule('0 * * * *', async () => {
    const dir = path.join(STORAGE, 'exports');
    try {
      const students = await readdir(dir).catch(() => []);
      let removed = 0;
      for (const sub of students) {
        const subDir = path.join(dir, sub);
        for (const f of await readdir(subDir).catch(() => [])) {
          const fp = path.join(subDir, f);
          const s = await stat(fp).catch(() => null);
          if (s && Date.now() - s.mtimeMs > 24 * 3600 * 1000) { await rm(fp).catch(() => {}); removed++; }
        }
      }
      if (removed) console.log(`[cron] cleaned ${removed} export files`);
    } catch { /* */ }
  });

  console.log('[cron] scheduled');
}
