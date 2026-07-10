export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

// M0 simplification: tokens in localStorage. M2 hardening moves dashboard
// sessions to httpOnly cookies.
export const session = {
  save(accessToken: string, user: unknown) {
    localStorage.setItem('ml.token', accessToken);
    localStorage.setItem('ml.user', JSON.stringify(user));
  },
  token: () => localStorage.getItem('ml.token'),
  user<T>(): T | null {
    const raw = localStorage.getItem('ml.user');
    return raw ? (JSON.parse(raw) as T) : null;
  },
  clear() {
    localStorage.removeItem('ml.token');
    localStorage.removeItem('ml.user');
  },
};
