// 批量帳號生成（§3.1）
import bcrypt from 'bcryptjs';
import { prisma } from './db';

function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export async function bulkGenerate(classId: string, prefix: string, count: number, startAt = 1) {
  const cls = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const created = [];
  for (let i = 0; i < count; i++) {
    const num = String(startAt + i).padStart(2, '0');
    const username = `${prefix}${num}`;
    const exists = await prisma.student.findUnique({ where: { username } });
    if (exists) continue;
    const password = randomDigits(6);
    const student = await prisma.student.create({
      data: {
        username, passwordHash: await bcrypt.hash(password, 10),
        classId, group: cls.group, active: true, initialPassword: password,
      },
    });
    created.push({ id: student.id, username, password });
  }
  return created;
}

export async function resetPassword(studentId: string): Promise<string> {
  const password = randomDigits(6);
  await prisma.student.update({
    where: { id: studentId },
    data: { passwordHash: await bcrypt.hash(password, 10), initialPassword: password, failedAttempts: 0, lockedUntil: null },
  });
  return password;
}
