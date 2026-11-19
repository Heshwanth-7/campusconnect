import { z } from 'zod';

const errorBody = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    lockedUntil: z.iso.datetime().optional(),
  }),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly lockedUntil?: string;

  constructor(
    status: number,
    message: string,
    code?: string,
    lockedUntil?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.lockedUntil = lockedUntil;
  }
}

let renewal: Promise<boolean> | undefined;
let generation = 0;
let lastRenewalSucceeded = true;
let sessionLost: (() => void) | undefined;

export function onSessionLost(handler: () => void) {
  sessionLost = handler;
  return () => {
    if (sessionLost === handler) sessionLost = undefined;
  };
}

function renewSession(requestGeneration: number) {
  if (renewal) return renewal;
  // A slow 401 may arrive after a different request has already rotated the cookie.
  if (generation !== requestGeneration) return Promise.resolve(lastRenewalSucceeded);

  renewal = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((response) => response.ok, () => false)
    .then((succeeded) => {
      generation++;
      lastRenewalSucceeded = succeeded;
      if (!succeeded) sessionLost?.();
      return succeeded;
    })
    .finally(() => { renewal = undefined; });

  return renewal;
}

export async function apiRequest(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: object; refresh?: boolean } = {},
): Promise<unknown> {
  const { method = 'GET', body, refresh = true } = options;
  const requestGeneration = generation;
  const request: RequestInit = {
    method,
    credentials: 'include',
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  };
  // Finish any in-flight rotation before setting or clearing session cookies.
  if (path === '/auth/login' || path === '/auth/logout') await renewal;

  let response = await fetch(`/api${path}`, request);
  if (response.status === 401 && refresh && await renewSession(requestGeneration)) {
    response = await fetch(`/api${path}`, request);
    if (response.status === 401) sessionLost?.();
  }
  if (!response.ok) {
    const parsed = errorBody.safeParse(await response.json().catch(() => undefined));
    const error = parsed.success ? parsed.data.error : undefined;
    throw new ApiError(response.status, error?.message ?? 'Something went wrong. Try again.', error?.code, error?.lockedUntil);
  }
  if (response.status === 204) return;
  return response.json();
}
