// v2.3 → v2.4 課堂 ID 遷移：把 lesson_access / quota_usage / artifacts / jobs 內的舊 lessonId 改成新 ID。
// 舊作品 role（palette/coloring/poster/storybook）保留原值（仍可在輪播／承接面板顯示）。
// 用法：tsx scripts/migrate-lesson-ids.ts
import 'dotenv/config';
import { prisma } from '../lib/db';
import { LESSON_ID_MIGRATION } from '../lib/config';

async function main() {
  let total = 0;
  for (const [oldId, newId] of Object.entries(LESSON_ID_MIGRATION)) {
    // lesson_access 主鍵含 lesson_id，用 raw update（避免與已存在新 ID 衝突：先刪新 ID 空殼再改名）
    const la = await prisma.$executeRawUnsafe(
      `UPDATE lesson_access SET lesson_id = $1 WHERE lesson_id = $2
       AND NOT EXISTS (SELECT 1 FROM lesson_access x WHERE x.class_id = lesson_access.class_id AND x.lesson_id = $1)`,
      newId, oldId,
    );
    // 若新 ID 已存在（seed 時建立的空殼），把舊列資料覆蓋過去後刪舊列
    await prisma.$executeRawUnsafe(
      `UPDATE lesson_access a SET enabled = b.enabled, quota_per_student = b.quota_per_student,
         cooldown_seconds = b.cooldown_seconds, opened_at = b.opened_at
       FROM lesson_access b
       WHERE a.class_id = b.class_id AND a.lesson_id = $1 AND b.lesson_id = $2`,
      newId, oldId,
    );
    await prisma.$executeRawUnsafe(`DELETE FROM lesson_access WHERE lesson_id = $1`, oldId);

    const qu = await prisma.quotaUsage.updateMany({ where: { lessonId: oldId }, data: { lessonId: newId } }).catch(() => ({ count: 0 }));
    const art = await prisma.artifact.updateMany({ where: { lessonId: oldId }, data: { lessonId: newId } });
    const job = await prisma.job.updateMany({ where: { lessonId: oldId }, data: { lessonId: newId } });
    const n = Number(la) + qu.count + art.count + job.count;
    total += n;
    console.log(`  ${oldId} → ${newId}: access≈${la}, quota=${qu.count}, artifacts=${art.count}, jobs=${job.count}`);
  }
  console.log(`✅ 課堂 ID 遷移完成（共 ${total} 列受影響）`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
