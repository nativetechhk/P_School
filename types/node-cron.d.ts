declare module 'node-cron' {
  export interface ScheduleOptions { timezone?: string; scheduled?: boolean }
  export interface ScheduledTask { start(): void; stop(): void }
  export function schedule(expr: string, fn: () => void | Promise<void>, opts?: ScheduleOptions): ScheduledTask;
  const _default: { schedule: typeof schedule };
  export default _default;
}
