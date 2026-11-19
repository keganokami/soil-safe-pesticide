# 運用マニュアル

土にやさしい農薬チェッカーを日々運用するための手順書です。
仕組みの概要とセットアップは [README](../README.md) を参照してください。

- サイト: https://keganokami.github.io/soil-safe-pesticide/
- リクエストフォーム（回答用）: https://docs.google.com/forms/d/e/1FAIpQLSdmxSPLwoT2VNAiS7wTBRIcDK2OZK2aiZKPwjD6V2Ah_dDK5A/viewform
- フォームの編集・回答一覧: Google フォームのマイフォーム「土にやさしい農薬チェッカー 判定リクエスト」
- 連携スクリプト: https://script.google.com のプロジェクト「農薬チェッカー フォーム連携」

---

## 1. ふだんの流れ（基本は放置でOK）

```
利用者 ─ Googleフォーム送信
          │  Apps Script が回数制限・入力の掃除をして Issue を作成（ラベル: 判定リクエスト, フォーム経由）
          ▼
GitHub Issue ─ Actions「判定リクエストの受付」が自動起動
          │  ① 入力ゲート → 農水省DB検索 → ② 対象判定ゲート → AI判定 → ③ 出力ゲート
          ▼
   ┌ 公開できた ……… 判定ファイルをコミット → Issue に結果を返信してクローズ → 数分後サイトに反映
   ├ 対象外 ……………「対象外」ラベルでクローズ。サイトには何も載らない
   ├ 候補が複数 ……「要確認」ラベルで保留  ← ★ 管理者の対応が必要（2章）
   └ 失敗 ……………「要確認」ラベルで保留  ← ★ 管理者の対応が必要（5章）

毎週月曜 3:00 ─ Actions「判定JSONの生成」が未判定・90日以上前の判定を最大10件作り直す
```

利用者は Issue を見られないので、結果は「数分後にサイトで商品名を検索」してもらう運用です。

---

## 2. 定期的にやること

| 頻度 | やること | 手順 |
|---|---|---|
| 週1回くらい | 「要確認」Issue の対応 | 3章 |
| 週1回くらい | 週次の生成が成功しているか確認 | Actions タブで「判定JSONの生成」が緑か見る。赤なら 6章 |
| 年1回（期限前） | GitHub トークン（フォーム用）の更新 | 7章 |
| 年1回（期限前） | Claude Code トークンの更新 | 7章 |

「要確認」Issue の一覧:
https://github.com/keganokami/soil-safe-pesticide/issues?q=is%3Aopen+label%3A要確認

GitHub の Watch 設定を「All Activity」にしておくと、Issue 作成・返信がメールで届きます。

---

## 3. 「要確認」Issue の対応

### 3-1. 候補が複数ある（いちばん多いケース）

例: 「スミチオン乳剤」は農水省DBに10件以上あり、どれか決められない。

1. Issue の最後のコメントに候補一覧（製品名と登録番号）が出ているので、内容を確認する
   - リクエストの「メーカー名」「自由記述」に手がかりがあればそれで選ぶ
   - 手がかりが無ければ、家庭園芸向けによく売られている製品（例: 住化スミチオン乳剤）を選ぶ
2. Issue 右上の「…」→「Edit」で本文を開き、`### 登録番号` の下の行を数字に書き換えて保存
   ```
   ### 登録番号

   4962
   ```
3. 保存すると自動で再判定が始まる（Actions タブで確認できる）。公開されると Issue は自動でクローズされる

> どうしても決められない／判定する価値がないときは、コメントで理由を書いて「Close as not planned」で閉じる。

### 3-2. 判定に失敗した（failed）

コメントに「判定中にエラーが発生しました」と出るケース。多くは一時的なもの（農水省サイトの応答なし、AIの混雑）。

1. Issue に `approved` ラベルを付ける → 同じ内容で再実行される
2. 2回続けて失敗するなら Actions のログを見る（6章）

---

## 4. 判定結果の手直し

### 4-1. 本物の農薬なのに「対象外」で閉じられた

AIの対象判定ゲート（②）が誤って弾いたケース。

- **Issue から再実行**: 閉じた Issue を Reopen し、`approved` ラベルを付ける
  - それでも弾かれる場合は、本文の「商品名」をラベル表記どおりに直すか、「登録番号」を入れてから `approved`
- **確実に載せたい**: 4-3 の方法で `data/products.txt` に `商品名,登録番号` で追加する

### 4-2. 判定内容がおかしい・古いので作り直したい

1. Actions →「判定JSONの生成」→「Run workflow」
2. `only` に商品名を入れて実行（カンマ区切りで複数可）。リクエスト時の名前・products.txt の名前と同じ表記にする
3. 数分〜十数分で再生成・デプロイされる

すべての判定は 90 日たつと週次の処理で自動的に作り直されます（`generate.yml` の `STALE_DAYS`）。

### 4-3. 商品を手動で追加する（リクエストを待たずに載せる）

`data/products.txt` に1行ずつ追記して push する。

```
ロハピ
住化スミチオン乳剤,4962     ← 同名製品が多いものは登録番号を付ける
```

次の週次実行で判定されます。すぐ判定したい場合は 4-2 の手順で `only` に名前を入れて実行。

### 4-4. 掲載を取り下げる

判定ファイルを消すだけだと、週次処理が「未判定」とみなして作り直してしまうので、**元データも一緒に消す**。

1. `public/data/verdicts/<ID>.json` を削除（ID はサイトの URL `?id=` の値）
2. 元データを削除
   - リクエスト由来: `data/requests/<Issue番号>.json`（中に `"name"` があるので grep で探せる）
   - 手動追加: `data/products.txt` の該当行
3. commit・push → 自動でデプロイされ、サイトから消える

```bash
grep -l "スミチオン" data/requests/*.json
git rm public/data/verdicts/4962.json data/requests/4.json
git commit -m "掲載取り下げ: 住化スミチオン乳剤" && git push
```

---

## 5. 設定を変える

| 変えたいもの | 場所 | 反映方法 |
|---|---|---|
| フォームの説明文・ヘルプ文 | `gas/form-to-issue.gs` の `TEXT` | 5-1 |
| フォームの1日の受付上限（全体） | `gas/form-to-issue.gs` の `DAILY_LIMIT`（既定30） | 5-1 の push のみ |
| GitHub 側の回数制限 | `.github/workflows/request.yml` の `PER_USER_PER_DAY`（3）・`TOTAL_PER_DAY`（30） | push |
| 週次の生成件数・作り直し間隔 | `.github/workflows/generate.yml` の `MAX_PER_RUN`（10）・`STALE_DAYS`（90） | push |
| 週次の実行日時 | `generate.yml` の `cron`（UTC表記。`0 18 * * 0` = 月曜3:00 JST） | push |
| 判定基準・調査方針 | `src/lib/prompt.ts` | push 後、4-2 で必要な商品を作り直す |
| NGワード | `scripts/guard.mjs` の `NG_INPUT`（入力用）・`NG_OUTPUT`（出力用） | push |
| 判定に使うモデル | `generate.mts` の `CLAUDE_MODEL`・`GATE_MODEL` の既定値 | push |

NGワードの注意: 出力用（`NG_OUTPUT`）に「殺す」「毒」など農薬の説明で普通に出る語を入れると、正当な判定まで公開されなくなります。暴力的な語は入力用（`NG_INPUT`）だけに入れてください。

### 5-1. Apps Script を更新する

フォームの URL や回答は変わりません。

```bash
cd gas
npx -y @google/clasp@3 push -f        # コードを送る（初回のみ npx @google/clasp login が必要）
npx -y @google/clasp@3 open-script    # エディタを開く
```

文言（`TEXT`）を変えた場合は、エディタで関数 **`updateForm`** を選んで「実行」する。
※ `setup` を再実行すると**新しいフォームが別に作られる**ので、作り直したいとき以外は実行しない
（作り直した場合は、新しい URL をリポジトリの Variables に登録し直す → 7章の表）。

---

## 6. トラブルシューティング

| 症状 | 確認すること | 対処 |
|---|---|---|
| フォームを送っても Issue ができない | script.google.com → プロジェクト → 左メニュー「実行数」で `onFormSubmit` のエラーを見る | `401 Bad credentials` → GitHub トークン期限切れ（7章）。ログに「1日の上限に達したため」→ 上限到達（日付が変わると回復。急ぐなら `DAILY_LIMIT` を上げる） |
| フォームを開くとログイン画面になる | フォームの編集画面の「公開」状態 | 「公開」→ 回答者を「リンクを知っている全員」に |
| Issue はできたが判定が動かない | Actions タブの「判定リクエストの受付」が skipped か | Issue に「判定リクエスト」ラベルが付いているか確認。付け直す（外して付ける）と起動する |
| 判定が「回数制限」で止まった | Issue のコメント | 上限は24時間単位。所有者が `approved` を付ければ再実行できる |
| Actions が `401` / `authentication` で失敗 | ログの「判定」ステップ | Claude Code トークン期限切れ（7章） |
| Actions が農水省サイトのエラーで失敗 | ログに `FAMIC` / `HTTP 5xx` | 一時的ならしばらくして `approved` で再実行。続く場合はサイト側の構造変更の可能性 → `src/lib/famic.ts` の修正が必要 |
| 判定は公開されたのにサイトに出ない | Actions の「GitHub Pages へデプロイ」が成功しているか | 失敗していれば手動で再実行。成功していればブラウザを再読み込み（キャッシュ） |
| サイトが「読み込み中」のまま／エラー表示 | `https://keganokami.github.io/soil-safe-pesticide/data/index.json` が開けるか | 開けなければデプロイを再実行 |
| 週次の生成が「上限に達したため残りは次回」 | 正常動作 | 急ぐなら手動実行で `max_per_run` を増やす |
| Max の利用枠を使い切った | Actions が rate limit 系で失敗 | 枠の回復を待つ。`MAX_PER_RUN` を減らす |

ログの見方: GitHub → Actions → 該当の実行 → ジョブ → 各ステップを開く。
判定の各段階の結果は「判定」ステップのログ（と実行ページの Summary）に、`✅` 公開 / `⚠️` 候補複数・取得失敗 / `🚫` ゲートで除外 / `❌` エラー の印付きで出ます。

---

## 7. 秘密情報・設定の一覧と更新

| 名前 | 置き場所 | 用途 | 期限・更新方法 |
|---|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | GitHub → Settings → Secrets and variables → Actions → **Secrets** | Actions から Claude Code（Max プラン）を使う | 約1年。ローカルで `claude setup-token` を実行し、出たトークンで Secret を上書き |
| `GITHUB_TOKEN` | Apps Script → プロジェクトの設定 → **スクリプト プロパティ** | フォームから Issue を作る | 作成時に選んだ期限（既定約1年）。下の手順で作り直す |
| `REQUEST_FORM_URL` | GitHub → … → Actions → **Variables** | サイトのリクエストボタンの飛び先 | フォームを作り直したときだけ変更 → デプロイ再実行 |
| `REQUEST_FORM_NAME_ENTRY` | 同上 | 検索語をフォームに引き継ぐ（`entry.671073678`） | 同上 |

**GitHub トークン（フォーム用）の作り直し**

1. 入力済みリンクを開く:
   https://github.com/settings/personal-access-tokens/new?name=soil-safe-form&target_name=keganokami&expires_in=366&issues=write
2. Repository access → Only select repositories → `soil-safe-pesticide`、権限が **Issues: Read and write** だけであることを確認 →「Generate token」
3. Apps Script のスクリプト プロパティ `GITHUB_TOKEN` の値を新しいトークンに置き換えて保存
4. 古いトークンを GitHub の設定画面で削除

トークンはチャット・Issue・コードに貼らないこと。漏れた場合はすぐ GitHub の設定画面で削除して作り直す。

---

## 8. ラベル一覧

| ラベル | 意味 | 誰が付けるか |
|---|---|---|
| `判定リクエスト` | 判定リクエストの Issue。**付与されると判定が起動する** | テンプレート／フォームが自動で |
| `フォーム経由` | Google フォームから作られた Issue（所有者の回数制限免除を適用しない） | フォームが自動で |
| `要確認` | 候補が複数・失敗などで保留。この状態で本文を編集すると再判定 | Actions が自動で |
| `対象外` | 農薬と無関係・不適切な入力として却下済み | Actions が自動で |
| `approved` | 付けると同じ内容で再判定（回数制限の手動解除にも使える） | **管理者が手動で** |

---

## 9. 費用

- GitHub（Pages・Actions）: 公開リポジトリなので無料
- Google フォーム・Apps Script: 無料
- Claude: Max プランの利用枠を消費（API 従量課金なし）。目安は1件あたり数分の Opus 利用。
  リクエストが急増したら `TOTAL_PER_DAY`・`DAILY_LIMIT`・`MAX_PER_RUN` を下げる
