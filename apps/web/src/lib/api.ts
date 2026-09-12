import { config } from './config';
import { useAuthStore } from '../stores/auth';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Thin typed fetch wrapper. Attaches the bearer token, parses the standard
 * `{ error: { code, message } }` envelope, and throws `ApiError` on failure.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const auth = useAuthStore.getState();
  const token = auth.accessToken;
  const res = await fetch(`${config.apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  if (res.status === 401 && !isRetry && !path.startsWith('/auth/')) {
    const refreshToken = auth.refreshToken;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${config.apiBase}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const newSession: AuthResponse = await refreshRes.json();
          auth.setSession(newSession);
          return apiFetch<T>(path, options, true);
        }
      } catch {
        // Refresh failed
      }
    }
    // If refresh failed or no refreshToken, clear stale session
    auth.clear();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'Request failed');
  }
  return data as T;
}

// ---- Auth endpoints (unauthenticated) ----

export interface AuthResponse {
  user: { id: string; email: string; displayName: string; avatarUrl: string | null };
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function signup(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

// ---- Media ----

export interface IceConfig {
  iceServers: RTCIceServer[];
}

export function getIceServers(): Promise<IceConfig> {
  return apiFetch('/media/ice');
}
