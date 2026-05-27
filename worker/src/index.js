// ============================================================
// Hokkaido Travel Note — Anthropic API Proxy (Cloudflare Worker)
// ============================================================
// Forwards POST /v1/messages requests to Anthropic, attaching the
// API key from the worker's secret store. The frontend never sees
// the key, so we avoid the public-repo auto-revoke problem.
//
// Required Worker secret (set via `wrangler secret put ANTHROPIC_API_KEY`):
//   ANTHROPIC_API_KEY — your sk-ant-... key
//
// Optional Worker variable (set in wrangler.toml [vars] or via dashboard):
//   ALLOWED_ORIGINS — comma-separated list of allowed Origin headers
//                     (default: "https://playmark0227-svg.github.io")
// ============================================================

const DEFAULT_ALLOWED_ORIGINS = [
  'https://playmark0227-svg.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:5173',
];

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, anthropic-version',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function pickAllowedOrigin(request, env) {
  const allowList = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const allowed = allowList.length ? allowList : DEFAULT_ALLOWED_ORIGINS;
  const origin = request.headers.get('Origin') || '';
  return allowed.includes(origin) ? origin : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = pickAllowedOrigin(request, env);

    // Preflight
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname !== '/v1/messages') {
      return new Response('Not Found', { status: 404 });
    }

    if (!origin) {
      return new Response(JSON.stringify({
        error: { type: 'forbidden_origin', message: 'Origin not allowed by this proxy.' },
      }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        error: { type: 'server_misconfigured', message: 'ANTHROPIC_API_KEY secret is not set on the Worker.' },
      }), {
        status: 500,
        headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Forward to Anthropic
    const anthropicVersion = request.headers.get('anthropic-version') || '2023-06-01';

    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': anthropicVersion,
        },
        body: request.body,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: { type: 'upstream_fetch_failed', message: String(err) },
      }), {
        status: 502,
        headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Stream the response back with CORS headers
    const upstreamHeaders = new Headers(upstream.headers);
    upstreamHeaders.set('Access-Control-Allow-Origin', origin);
    upstreamHeaders.set('Vary', 'Origin');
    // Drop any hop-by-hop headers
    upstreamHeaders.delete('transfer-encoding');

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstreamHeaders,
    });
  },
};
