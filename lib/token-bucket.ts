// 全域 token bucket（§6.3）：Redis INCR + TTL，worker 取 token 才發請求
import type Redis from 'ioredis';

/** 嘗試在當前分鐘取一個 token。回傳 true = 可發請求。 */
export async function tryAcquire(redis: Redis, bucket: string, rpm: number): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000);
  const key = `${bucket}:${minute}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 90);
  if (n > rpm) {
    await redis.decr(key);
    return false;
  }
  return true;
}

/** 阻塞直到取得 token（每 500ms 重試）。 */
export async function acquire(redis: Redis, bucket: string, rpm: number, maxWaitMs = 120000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await tryAcquire(redis, bucket, rpm)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
