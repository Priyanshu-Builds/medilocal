export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ml.token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Token missing/expired → drop the session and bounce to login.
    session.clear();
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
      location.href = '/login';
    }
    throw new ApiError('Session expired — please sign in again', 401);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new ApiError(message ?? `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_URL}${path}`, { headers: { ...authHeaders() } }).then(handle<T>);
}

function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle<T>);
}

export const apiPost = <T>(path: string, body?: unknown) => send<T>('POST', path, body);
export const apiPatch = <T>(path: string, body?: unknown) => send<T>('PATCH', path, body);
export const apiPut = <T>(path: string, body?: unknown) => send<T>('PUT', path, body);
export const apiDelete = <T>(path: string) => send<T>('DELETE', path);

// M0/M2 pilot simplification: tokens in localStorage. Production hardening
// (M5) moves dashboard sessions to httpOnly cookies + refresh rotation.
export const session = {
  save(accessToken: string, user: unknown) {
    localStorage.setItem('ml.token', accessToken);
    localStorage.setItem('ml.user', JSON.stringify(user));
  },
  token: () => (typeof window !== 'undefined' ? localStorage.getItem('ml.token') : null),
  user<T>(): T | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('ml.user');
    return raw ? (JSON.parse(raw) as T) : null;
  },
  clear() {
    localStorage.removeItem('ml.token');
    localStorage.removeItem('ml.user');
  },
};
