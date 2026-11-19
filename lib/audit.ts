import { prisma } from './db';

export async function audit(actor: string, action: string, target?: string) {
  await prisma.audit.create({ data: { actor, action, target } }).catch(() => {});
}
