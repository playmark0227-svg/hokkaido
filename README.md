# ほっかいどう旅手帖 / HOKKAIDO TRAVEL NOTE

北海道のすべての観光スポットを、可愛らしくまとめた観光ポータルサイト。
最終的には観光地・宿・自治体向けのPR動画制作によるマネタイズを行うことを想定しています。

## サイト構成

- `index.html` — ホーム (ヒーロー / エリア / 人気スポット / 四季 / 動画CTA)
- `spots.html` — 観光スポット一覧 (エリア・カテゴリ・キーワード検索)
- `video.html` — 動画制作サービス (料金プラン・FAQ・お問い合わせ)

## ディレクトリ構造

```
.
├── index.html
├── spots.html
├── video.html
├── css/
│   └── style.css        # パステル系・可愛い系のデザインシステム
└── js/
    ├── spots.js         # 観光地データ (64件)
    ├── icons.js         # 40種類のSVGイラストアイコン
    └── main.js          # レンダリング・フィルター・検索
```

## 特徴

- **静的HTML/CSS/JSのみ** — ビルド不要、GitHub Pages にそのまま公開可能
- **64の観光スポット** を道央/道南/道東/道北の4エリアに分類
- **6カテゴリ** (自然・街・温泉・グルメ・文化・季節) でフィルタリング
- **40種類の手描き風SVGイラスト** で観光地を表現
- **完全レスポンシブ** — モバイル・タブレット・PCに対応
- **動画制作のマネタイズ導線** — 3プランの料金表示・お問い合わせフォーム

## ローカルでの動作確認

```bash
python3 -m http.server 8000
# → http://localhost:8000 を開く
```

## 公開方法 (GitHub Pages)

1. リポジトリの Settings → Pages
2. Source を `Deploy from a branch` に設定
3. Branch を `main` (もしくは公開したいブランチ) の `/ (root)` に設定
4. 数分後に `https://<user>.github.io/hokkaido/` で公開される

## カスタマイズメモ

- 観光地の追加: `js/spots.js` の `SPOTS` 配列に追記
- カラーパレットの変更: `css/style.css` の `:root` の CSS 変数
- 新しいアイコン: `js/icons.js` に SVG を追加し、`spots.js` の `icon` フィールドで参照

## 今後の拡張アイデア

- 各スポットの詳細ページ (個別URL)
- 写真ギャラリー / 動画埋め込み
- マップ表示 (Leaflet / Google Maps)
- 多言語化 (EN/ZH/KO)
- お気に入り保存 (localStorage)
- 季節別オススメ自動切り替え
