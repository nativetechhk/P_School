// StorageDriver 抽象（§8）：目前本機磁碟；日後可換 S3/MinIO/R2
import { createHmac } from 'crypto';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(process.env.STORAGE_PATH || './data/uploads');

export interface StorageDriver {
  save(relPath: string, data: Buffer): Promise<string>;
  read(relPath: string): Promise<Buffer>;
  remove(relPath: string): Promise<void>;
  absolute(relPath: string): string;
}

class LocalDriver implements StorageDriver {
  async save(relPath: string, data: Buffer): Promise<string> {
    const abs = this.absolute(relPath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
    return relPath;
  }
  async read(relPath: string): Promise<Buffer> {
    return readFile(this.absolute(relPath));
  }
  async remove(relPath: string): Promise<void> {
    await unlink(this.absolute(relPath)).catch(() => {});
  }
  absolute(relPath: string): string {
    const abs = path.resolve(ROOT, relPath.replace(/^\/+/, ''));
    if (!abs.startsWith(ROOT)) throw new Error('path traversal');
    return abs;
  }
}

export const storage: StorageDriver = new LocalDriver();

// signed-path：HMAC + 到期時間（§8 檔案下載）
export function signPath(relPath: string, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac('sha256', process.env.SESSION_SECRET!).update(`${relPath}:${exp}`).digest('hex').slice(0, 32);
  return `/api/files/${encodeURIComponent(relPath)}?exp=${exp}&sig=${sig}`;
}

export function verifySignedPath(relPath: string, exp: string, sig: string): boolean {
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expect = createHmac('sha256', process.env.SESSION_SECRET!).update(`${relPath}:${exp}`).digest('hex').slice(0, 32);
  return sig === expect;
}
