// 批量生成帳號：tsx scripts/generate-accounts.ts <classId> <prefix> <count>
import 'dotenv/config';
import { bulkGenerate } from '../lib/accounts';

async function main() {
  const [classId, prefix, count] = process.argv.slice(2);
  if (!classId || !prefix || !count) { console.error('用法: generate-accounts.ts <classId> <prefix> <count>'); process.exit(1); }
  const created = await bulkGenerate(classId, prefix, Number(count));
  console.table(created.map((c) => ({ username: c.username, password: c.password })));
  console.log(`✅ 已生成 ${created.length} 個帳號`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
