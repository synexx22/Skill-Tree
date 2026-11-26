// CORS / origin policy shared by the API routes.
// The web build is same-origin. The mobile (Capacitor) app is served from its own
// local origin and calls the deployed API cross-origin, so those origins are allowed too.

const DEFAULT_APP_ORIGINS = [
  'capacitor://localhost', // iOS (Capacitor)
  'https://localhost', // Android (Capacitor, androidScheme: https)
  'http://localhost', // Android (Capacitor, http scheme) / local dev
];

function allowedOrigins(): Set<string> {
  const extra = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_APP_ORIGINS, ...extra]);
}

function isSameOrigin(request: Request, origin: string): boolean {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** True when the request carries an Origin that is neither this site nor an allowed app origin. */
export function isForeignOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return !isSameOrigin(request, origin) && !allowedOrigins().has(origin);
}

/** CORS headers for an allowed cross-origin caller; empty for same-origin / no Origin. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || isSameOrigin(request, origin) || !allowedOrigins().has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function preflight(request: Request): Response {
  if (isForeignOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
