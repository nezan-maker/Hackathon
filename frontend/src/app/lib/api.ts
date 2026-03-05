const resolveDefaultApiUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5500';
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalHost) {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${window.location.hostname}:5500`;
  }

  return window.location.origin;
};

const API_URL = ((import.meta as any).env?.VITE_API_URL ?? resolveDefaultApiUrl()).replace(/\/+$/, '');

interface ApiError {
  message?: string;
  error?: string;
}

let csrfTokenCache: string | null = null;
let csrfFetchPromise: Promise<string> | null = null;
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isStateChangingMethod = (method: string) =>
  STATE_CHANGING_METHODS.has(String(method).toUpperCase());

const isCsrfError = (body: ApiError): boolean =>
  /csrf/i.test(String(body.error ?? body.message ?? ''));

async function parseError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  const message = body.error ?? body.message ?? `Request failed with status ${response.status}`;
  return new Error(message);
}

export const clearCsrfTokenCache = () => {
  csrfTokenCache = null;
  csrfFetchPromise = null;
};

const getCsrfToken = async (): Promise<string> => {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  if (!csrfFetchPromise) {
    csrfFetchPromise = fetch(`${API_URL}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw await parseError(response);
        }
        const body = (await response.json()) as { csrfToken?: string };
        if (!body.csrfToken) {
          throw new Error('Unable to retrieve CSRF token');
        }
        csrfTokenCache = body.csrfToken;
        return body.csrfToken;
      })
      .finally(() => {
        csrfFetchPromise = null;
      });
  }

  return csrfFetchPromise;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf = isStateChangingMethod(method);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  const performRequest = async (csrfToken?: string) =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: {
        ...headers,
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      ...init,
    });

  let csrfToken = needsCsrf ? await getCsrfToken() : undefined;
  let response = await performRequest(csrfToken);

  if (!response.ok && needsCsrf && response.status === 403) {
    const body = (await response.clone().json().catch(() => ({}))) as ApiError;
    if (isCsrfError(body)) {
      clearCsrfTokenCache();
      csrfToken = await getCsrfToken();
      response = await performRequest(csrfToken);
    }
  }

  if (!response.ok) {
    if (needsCsrf && response.status === 403) {
      clearCsrfTokenCache();
    }
    throw await parseError(response);
  }

  return (await response.json().catch(() => ({}))) as T;
}

export { API_URL };
