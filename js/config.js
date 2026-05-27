// ============================================================
// Site Configuration
// ============================================================
// API key はクライアント側には置きません。
// Cloudflare Worker のプロキシを経由して Anthropic API を呼びます。
// 詳細: worker/README.md を参照。
//
// デプロイ後、Worker の URL を下の ANTHROPIC_PROXY_URL に設定してください。
// 例: 'https://hokkaido-anthropic-proxy.YOUR-SUBDOMAIN.workers.dev'
// ============================================================

window.ANTHROPIC_PROXY_URL = 'https://hokkaido-anthropic-proxy.ayukun-0227.workers.dev';
