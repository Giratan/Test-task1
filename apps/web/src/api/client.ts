import type { ApiError } from '@checkout/contracts';

const STORAGE_KEY = 'checkout:token';

export function getBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const PAYMENT_KEY = 'checkout:activePayment';
const ORDER_KEY = 'checkout:activeOrder';

export function setActivePaymentId(id: string | null) {
  try {
    if (id) localStorage.setItem(PAYMENT_KEY, id);
    else localStorage.removeItem(PAYMENT_KEY);
  } catch {}
}

export function getActivePaymentId(): string | null {
  try {
    return localStorage.getItem(PAYMENT_KEY);
  } catch {
    return null;
  }
}

export function setActiveOrderId(id: string | null) {
  try {
    if (id) localStorage.setItem(ORDER_KEY, id);
    else localStorage.removeItem(ORDER_KEY);
  } catch {}
}

export function getActiveOrderId(): string | null {
  try {
    return localStorage.getItem(ORDER_KEY);
  } catch {
    return null;
  }
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export function getErrorMessage(
  error: unknown,
  fallback = 'Произошла ошибка. Повторите действие.',
) {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as { error?: { message?: string } };
    if (apiError.error?.message) return apiError.error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

async function parseJsonSafe(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    const e: ApiError = {
      error: { code: 'invalid_json', message: 'Invalid JSON response', fields: [] },
      meta: { requestId: '' },
    };
    throw e;
  }
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}) {
  const url = new URL(path, getBaseUrl()).toString();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...opts.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const parsed = await parseJsonSafe(res);

  if (res.ok) {
    return (parsed?.data ?? parsed) as T;
  }

  const headerRequestId = res.headers.get('X-Request-Id') || '';
  const apiErr = (parsed as ApiError | null) || null;
  if (apiErr) {
    if (!apiErr.meta) apiErr.meta = { requestId: headerRequestId };
    else if (!apiErr.meta.requestId) apiErr.meta.requestId = headerRequestId;
    throw apiErr;
  }

  const fallback: ApiError = {
    error: { code: String(res.status), message: res.statusText || 'HTTP error', fields: [] },
    meta: { requestId: headerRequestId },
  };
  throw fallback;
}

export const api = {
  get: <T = unknown>(p: string, signal?: AbortSignal) => request<T>(p, { method: 'GET', signal }),
  post: <T = unknown>(
    p: string,
    body?: unknown,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ) => request<T>(p, { method: 'POST', body, headers, signal }),
  put: <T = unknown>(
    p: string,
    body?: unknown,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ) => request<T>(p, { method: 'PUT', body, headers, signal }),
  del: <T = unknown>(p: string, signal?: AbortSignal) =>
    request<T>(p, { method: 'DELETE', signal }),
};

export default api;
