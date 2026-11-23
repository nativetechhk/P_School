// 種子：建 admin、匯入 prompt 種子；非 prod 另建示範班 10 帳號 + 開放 senior-l3
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/db';
import { importPromptSeed } from '../lib/prompt-seed';
import { bulkGenerate } from '../lib/accounts';
import { LESSONS } from '../lib/config';

const IS_PROD = process.argv.includes('--prod');

async function main() {
  // 1. admin
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  const existing = await prisma.staff.findUnique({ where: { email } });
  if (!existing) {
    await prisma.staff.create({ data: { email, passwordHash: await bcrypt.hash(password, 10), role: 'admin' } });
    console.log(`✅ admin 建立：${email} / ${password}`);
  } else {
    console.log(`ℹ️  admin 已存在：${email}`);
  }

  // 2. prompt 種子
  const seedPath = path.resolve(process.cwd(), '..', 'prompt_templates.seed.json');
  const localSeed = path.resolve(process.cwd(), 'content', 'prompt_templates.seed.json');
  let seedFile: string;
  try { seedFile = readFileSync(localSeed, 'utf8'); }
  catch { seedFile = readFileSync(seedPath, 'utf8'); }
  const count = await importPromptSeed(JSON.parse(seedFile), { overwrite: true });
  console.log(`✅ 匯入 prompt 模板：${count} 項`);

  // 3. 預設全域設定
  for (const [key, value] of Object.entries({ bootstrapped: true })) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  if (IS_PROD) {
    console.log('🏁 prod 種子完成（不建示範班）');
    return;
  }

  // 4. 示範班（senior + junior 各一）
  let demoSenior = await prisma.class.findFirst({ where: { name: '示範高年級班' } });
  if (!demoSenior) {
    demoSenior = await prisma.class.create({ data: { name: '示範高年級班', group: 'senior', note: 'seed' } });
    await prisma.lessonAccess.createMany({
      data: LESSONS.filter((l) => l.group === 'senior').map((l) => ({
        classId: demoSenior!.id, lessonId: l.id, enabled: l.id === 'senior-l3-character',
        quotaPerStudent: l.defaultQuota || 10, cooldownSeconds: 60,
        openedAt: l.id === 'senior-l3-character' ? new Date() : null,
      })),
    });
    const created = await bulkGenerate(demoSenior.id, 'S4-', 10);
    console.log(`✅ 示範高年級班 + ${created.length} 帳號；已開放 senior-l3`);
    console.log(`   範例帳號：${created[0]?.username} / ${created[0]?.password}`);
  }

  let demoJunior = await prisma.class.findFirst({ where: { name: '示範低年級班' } });
  if (!demoJunior) {
    demoJunior = await prisma.class.create({ data: { name: '示範低年級班', group: 'junior', note: 'seed' } });
    await prisma.lessonAccess.createMany({
      data: LESSONS.filter((l) => l.group === 'junior').map((l) => ({
        classId: demoJunior!.id, lessonId: l.id, enabled: l.id === 'junior-l4-generate-style',
        quotaPerStudent: l.defaultQuota || 6, cooldownSeconds: 60,
        openedAt: l.id === 'junior-l4-generate-style' ? new Date() : null,
      })),
    });
    const created = await bulkGenerate(demoJunior.id, 'S1-', 10);
    console.log(`✅ 示範低年級班 + ${created.length} 帳號；已開放 junior-l4`);
    console.log(`   範例帳號：${created[0]?.username} / ${created[0]?.password}`);
  }

  // 5. 預設黑名單（人類詞已在 global.humanBlockTerms；此處加常見不當詞示範）
  const defaults = ['血腥', '暴力', '武器'];
  for (const term of defaults) {
    const ex = await prisma.blacklist.findFirst({ where: { term } });
    if (!ex) await prisma.blacklist.create({ data: { term, mode: 'block', createdBy: 'seed' } });
  }
  console.log('🏁 本機種子完成');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
