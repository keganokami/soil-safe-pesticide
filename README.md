# 土にやさしい農薬チェッカー

農薬の**商品名**から、150cm×150cm（土の高さ約60cm）の区画で土壌の活性を損なわずに使えるかを判定し、
結果を GitHub Pages で公開する静的サイトです。判定は **週1回の GitHub Actions** で Claude Code が生成します（API従量課金なし）。

- **出力**: 判定（許可 / 条件付き許可 / 不可 / 判定不能）、土壌影響評価（残留性・移動性・土壌生物・流出時リスク）、
  許可時は区画あたりの使用量・使い方・こぼれ対策、不可時は理由と代替案、参照URL

## 仕組み

```
data/products.txt ──(週1 Actions: npm run generate)──▶ public/data/*.json ──(Pages デプロイ)──▶ 静的サイト
   ▲                     │
   │                     ├─ 1. 農林水産省 農薬登録情報提供システムで登録番号・有効成分・適用表を取得
   │                     └─ 2. Claude Code (claude -p, WebSearch/WebFetch) が環境データを調査し JSON スキーマで判定
   └── Issue「判定リクエスト」に approved ラベル → 自動追加して即判定
```

| パス | 役割 |
|---|---|
| `data/products.txt` | 判定対象の商品名リスト（`商品名` または `商品名,登録番号`） |
| `scripts/generate.mts` | 判定JSON生成（未判定・90日以上前のものを1回最大10件） |
| `src/lib/famic.ts` | 農薬登録情報の検索・詳細取得 |
| `src/lib/prompt.ts` | 判定基準・調査方針（システムプロンプト） |
| `src/lib/verdict.ts` | 判定結果の JSON スキーマ |
| `public/data/` | 生成された判定データ |
| `.github/workflows/generate.yml` | 週1回（月曜 3:00 JST）の生成 |
| `.github/workflows/deploy.yml` | GitHub Pages へのデプロイ |
| `.github/workflows/request.yml` | Issue からの判定リクエスト受付 |

## セットアップ

1. ローカルで `claude setup-token` を実行し、表示されたトークンをリポジトリの Secret `CLAUDE_CODE_OAUTH_TOKEN` に登録
2. Settings → Pages → Source を **GitHub Actions** に設定
3. Issues で `approved` ラベルを作成（リクエスト受付を使う場合）
4. Actions → 「判定JSONの生成」を手動実行して動作確認

## ローカル

```bash
npm install
npm run generate   # ローカルの Claude Code ログインで判定を生成
npm run dev        # http://localhost:3000
```

## 注意

- 判定は参考情報です。使用前に必ず製品ラベルを確認し、農薬取締法（適用作物以外への使用禁止など）に従ってください。
- 生成は Claude の Max/Pro プランの利用枠を消費します。件数は `MAX_PER_RUN` で調整できます。
