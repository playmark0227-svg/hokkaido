# Hokkaido Anthropic Proxy (Cloudflare Worker)

サイトから Anthropic API を叩くときに、API キーを **クライアントに置かない** ようにするための薄いプロキシです。

GitHub Pages 上の `js/config.js` には Worker の URL だけを設定し、API キーは Worker の Secret として保管します。これで:
- 公開リポジトリへの自動 revoke を回避
- キー流出時のローテーションがフロント変更なしでできる
- Origin チェックで第三者サイトからの悪用を防げる

---

## 初回デプロイ手順

### 0. 前提
- Node.js (v18+) がインストールされていること
- Cloudflare の無料アカウントを持っていること

### 1. wrangler をインストール

```bash
cd worker
npm install
```

### 2. Cloudflare にログイン

```bash
npx wrangler login
```
ブラウザが開いて Cloudflare にログイン → "Authorize Wrangler" を押す。

### 3. API キーを Secret として登録

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```
プロンプトが出るので Anthropic Console で発行した `sk-ant-...` キーを貼り付けて Enter。
**この値は Cloudflare の Worker Secret として暗号化保存され、コードには残りません。**

### 4. Worker をデプロイ

```bash
npx wrangler deploy
```

出力に Worker の URL が表示されます。例:
```
Published hokkaido-anthropic-proxy (X.XX sec)
  https://hokkaido-anthropic-proxy.<your-subdomain>.workers.dev
```

この URL をコピーしておく。

### 5. フロントエンドに Worker URL を設定

リポジトリの `js/config.js` を編集:

```js
window.ANTHROPIC_PROXY_URL = 'https://hokkaido-anthropic-proxy.<your-subdomain>.workers.dev';
```

コミット & プッシュ。GitHub Pages がデプロイされれば、サイトから Worker 経由で Anthropic API を呼べるようになります。

---

## CORS / Origin チェック

デフォルトでは以下の Origin だけが許可されます:

- `https://playmark0227-svg.github.io` (本番)
- `http://localhost:8000` / `http://127.0.0.1:8000` / `http://localhost:5173` (ローカル開発)

別のドメインを追加したい場合は `wrangler.toml` の `[vars]` セクションに

```toml
[vars]
ALLOWED_ORIGINS = "https://playmark0227-svg.github.io,https://your-custom-domain.com"
```

を追加して `npx wrangler deploy` で再デプロイ。

---

## キーをローテーションする

Anthropic Console で新しいキーを発行した後:

```bash
cd worker
npx wrangler secret put ANTHROPIC_API_KEY
# 新しいキーを貼って Enter
```

これだけで OK。フロントエンドの変更もデプロイも不要 (Secret は即時反映される)。

---

## 動作確認

ローカルで Worker を起動して確認:

```bash
npx wrangler dev
# → http://localhost:8787 で起動
```

Origin が許可されたページからアクセスすれば Anthropic に転送されます。

ログを見たい場合:

```bash
npx wrangler tail
```

---

## コストの目安

- Cloudflare Workers Free プラン: **1日10万リクエストまで無料**
- Anthropic API の料金は通常通り (Worker は転送するだけ)

日常的なデモ運用なら追加コスト 0 円で運用可能です。
