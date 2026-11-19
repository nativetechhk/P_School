// SSE 事件：Redis pub/sub，web 與 worker 共用
import { redis } from './redis';

export type PlatformEvent =
  | { type: 'job'; jobId: string; status: string; position?: number; artifactIds?: string[]; error?: string }
  | { type: 'artifact_new'; classId: string; lessonId: string; artifactId: string }
  | { type: 'artifact_hidden'; classId: string; artifactId: string }
  | { type: 'artifact_heart'; classId: string; artifactId: string; hearts: number };

export const EVENTS_CHANNEL = 'aiclass:events';

export async function publishEvent(ev: PlatformEvent) {
  await redis.publish(EVENTS_CHANNEL, JSON.stringify(ev));
}
