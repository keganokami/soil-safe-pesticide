# 土にやさしい農薬チェッカー

> 日々の運用（要確認Issueの対応・再判定・取り下げ・トークン更新・トラブル対応）は **[運用マニュアル](docs/OPERATIONS.md)** を参照。

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
   └── Googleフォーム / Issue「判定リクエスト」→ 自動で受付・判定・返信
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
| `.github/workflows/request.yml` | Issue からの判定リクエスト受付（自動判定・返信） |
| `gas/form-to-issue.gs` | Googleフォーム → Issue 連携（Apps Script） |
| `scripts/guard.mjs` | ハーネスの決定的チェック（入力・出力・公開ゲート） |

## 安全対策（ハーネス）

いたずら・攻撃的な入力で不適切な結果が公開されたり、画面が壊れたりしないよう、多層で防御しています。

| 層 | 内容 | 実装 |
|---|---|---|
| ① 入力ゲート | URL・HTML・記号のみ・同一文字の連続・NGワード・長さを決定的に拒否。1人3件/日・全体30件/日の回数制限 | `scripts/guard.mjs` `scripts/add-request.mjs` `request.yml` |
| ② 対象判定ゲート | 農薬登録が見つからない名前は軽量モデル（Haiku）で「実在する農薬・園芸資材か」を判定。対象外は打ち切り | `scripts/generate.mts` |
| ③ 出力ゲート | AI出力の型・列挙値・長さ・URL（http/https のみ）・NGワードを検査し無害化。不合格は公開しない | `scripts/guard.mjs` |
| ④ 公開ゲート | ビルド時に検査済みの判定ファイルだけから一覧を作る。壊れた/改ざんされたファイルは除外 | `scripts/build-index.mjs` |
| ⑤ 画面 | 配信データを型検査し不正なものは表示しない。危険なリンクを無効化。描画エラーは部分的に隔離 | `src/lib/validate.ts` `ErrorBoundary` |

対象外と判定したリクエストは公開データに何も残さず、Issue に「対象外」ラベルを付けてクローズします。
AI は WebSearch / WebFetch 以外のツールを使えず、空ディレクトリで実行されます。

## Googleフォーム連携（GitHubアカウントが無い利用者向け）

利用者は Google フォームから送信 → Apps Script が GitHub Issue を作成 → 上記の自動判定が動きます。

1. GitHub で **fine-grained personal access token** を作成（対象リポジトリはこのリポジトリのみ、権限は **Issues: Read and write** のみ）。
   入力済みリンク: https://github.com/settings/personal-access-tokens/new?name=soil-safe-form&target_name=keganokami&expires_in=366&issues=write
2. Apps Script プロジェクトを作ってコードを送る（[clasp](https://github.com/google/clasp)。初回は https://script.google.com/home/usersettings で Apps Script API をオン）
   ```bash
   npx -y @google/clasp@3 login
   cd gas && npx -y @google/clasp@3 create-script --type standalone --title "農薬チェッカー フォーム連携" --rootDir .
   npx -y @google/clasp@3 push -f && npx -y @google/clasp@3 open-script
   ```
   （clasp を使わない場合は script.google.com で新規プロジェクトを作り `gas/form-to-issue.gs` を貼り付け）
3. プロジェクトの設定 → スクリプト プロパティに `GITHUB_TOKEN` = 1 のトークンを追加
4. エディタで関数 `setup` を実行（権限を承認）。フォームが公開状態で作成され、送信トリガーが登録される
   - フォームを開いてログインを求められる場合は、編集画面の「公開」→ 回答者「リンクを知っている全員」
5. 実行ログに出る URL を、リポジトリの Settings → Secrets and variables → Actions → **Variables** に設定
   - `REQUEST_FORM_URL` = 回答用URL
   - `REQUEST_FORM_NAME_ENTRY` = 事前入力URL中の `entry.数字`（サイトで検索した語をフォームに引き継ぐ）
6. Actions →「GitHub Pages へデプロイ」を実行すると、サイトの「判定をリクエストする」がフォームに切り替わる

フォーム経由の Issue には「フォーム経由」ラベルが付き、回数制限はフォーム側（全体30件/日）と Actions 側の両方でかかります。
フォームの文言を変えるときは `gas/form-to-issue.gs` の `TEXT` を編集 → `clasp push` → エディタで `updateForm` を実行（`setup` の再実行は新しいフォームを作るので不要）。

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
