# 土にやさしい農薬チェッカー

農薬の**商品名**を入力すると、150cm×150cm（土の高さ約60cm）の区画で
土壌の活性を損なわずに使えるかを AI エージェントが判定する Web アプリです。

- **出力**: 判定（許可 / 条件付き許可 / 不可 / 判定不能）、許可時は区画あたりの使用量・使い方・こぼれ対策、不可時は理由と代替案、参照URL

## 仕組み

1. **農林水産省 農薬登録情報提供システム**（https://pesticide.maff.go.jp/）を商品名で検索し、
   登録番号・有効成分・適用表を取得（公開APIが無いため検索フォーム/詳細ページをサーバー側で解析）
2. **Claude（claude-opus-5-5）** が Web 検索・取得ツールで、有効成分の土壌半減期(DT50)・Koc・
   ミミズ/土壌微生物毒性・水生生物毒性を、農水省/環境省/食品安全委員会の評価書、メーカーSDS、
   PPDB(Univ. of Hertfordshire) などから調査
3. 判定基準（土壌残留性・移動性・土壌生物・流出時リスク・作用様式）に沿って構造化された判定を返却
   （10aあたりの量 × 0.00225 で区画量を換算）

| パス | 役割 |
|---|---|
| `src/lib/famic.ts` | 農薬登録情報の検索・詳細取得 |
| `src/lib/agent.ts` | 判定エージェント（システムプロンプト・判定基準・ツールループ） |
| `src/lib/verdict.ts` | 判定結果のスキーマ |
| `src/app/api/search` | 商品名→候補一覧 |
| `src/app/api/judge` | 判定（SSEで進捗をストリーミング） |

## ローカル実行

```bash
cp .env.example .env.local   # ANTHROPIC_API_KEY を設定
npm install
npm run dev                  # http://localhost:3000
```

## デプロイ（Vercel）

APIキーをサーバー側で保持する必要があるため GitHub Pages（静的ホスティング）ではなく **Vercel** を使います。

1. GitHub に push → Vercel で Import
2. Environment Variables に `ANTHROPIC_API_KEY`（任意で `APP_PASSCODE`）を設定
3. API ルートは東京リージョン(`hnd1`)・最大300秒で動作します

## 注意

- 判定は参考情報です。使用前に必ず製品ラベルを確認し、農薬取締法（適用作物以外への使用禁止など）に従ってください。
- 1回の判定で Claude API の利用料（Web検索含む）が発生します。公開する場合は `APP_PASSCODE` の設定を推奨します。
