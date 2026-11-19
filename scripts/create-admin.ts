// 建立 admin 帳號：tsx scripts/create-admin.ts <email> <password> [role]
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db';

async function main() {
  const [email, password, role = 'admin'] = process.argv.slice(2);
  if (!email || !password) { console.error('用法: create-admin.ts <email> <password> [admin|assistant]'); process.exit(1); }
  const hash = await bcrypt.hash(password, 10);
  await prisma.staff.upsert({
    where: { email }, update: { passwordHash: hash, role }, create: { email, passwordHash: hash, role },
  });
  console.log(`✅ ${role} 帳號已建立／更新：${email}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
