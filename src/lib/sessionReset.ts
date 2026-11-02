const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(encoded.padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '='));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

// When this session was signed in. The JWT `amr` timestamp is fixed for the life of
// a session and is new after every login, so token refreshes do not move it.
export const getSessionSignedInAt = (accessToken?: string, lastSignInAt?: string | null): number | null => {
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  const amr = Array.isArray(payload?.amr) ? payload.amr as Array<{ timestamp?: unknown }> : [];
  const seconds = amr.map((entry) => entry?.timestamp).filter((value): value is number => typeof value === 'number');
  if (seconds.length > 0) return Math.max(...seconds) * 1000;
  const fallback = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  return Number.isNaN(fallback) ? null : fallback;
};

// True only when a reset is known to be newer than this session. Missing data means
// "keep the session", so a student who signs in again can never be stuck in a loop.
export const isSessionInvalidated = (resetAt: string | null | undefined, signedInAt: number | null) => {
  if (!resetAt || signedInAt === null) return false;
  const reset = Date.parse(resetAt);
  return !Number.isNaN(reset) && reset > signedInAt;
};
