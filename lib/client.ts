'use client';

export async function api<T = unknown>(url: string, opts?: RequestInit & { json?: unknown }): Promise<T> {
  const init: RequestInit = { ...opts, headers: { ...(opts?.headers ?? {}) } };
  if (opts?.json !== undefined) {
    init.method = opts.method ?? 'POST';
    init.body = JSON.stringify(opts.json);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!res.ok && (data as { ok?: boolean }).ok === undefined) {
    throw Object.assign(new Error((data as { error?: string }).error ?? `HTTP ${res.status}`), { status: res.status, data });
  }
  return data as T;
}
