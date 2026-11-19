/**
 * 判定リクエスト用 Google フォーム → GitHub Issue 連携（Google Apps Script）
 *
 * GitHub アカウントが無い利用者でも判定をリクエストできるよう、フォームの回答から
 * 「判定リクエスト」Issue を自動で作成する。Issue が立つと GitHub Actions の自動判定が動く。
 *
 * セットアップ（README「Googleフォーム連携」参照）
 *   1. https://script.google.com で新しいプロジェクトを作り、このファイルの内容を貼り付ける
 *   2. プロジェクトの設定 → スクリプト プロパティに GITHUB_TOKEN（Issues: Read and write のみの fine-grained PAT）を追加
 *   3. 関数 setup を選んで実行（初回は権限の承認が出る）→ フォームが作成され、送信トリガーが登録される
 *   4. ログに出るフォームURLを、GitHub リポジトリの Variables「REQUEST_FORM_URL」に設定
 */

const REPO = "keganokami/soil-safe-pesticide";
const LABELS = ["判定リクエスト", "フォーム経由"];
const DAILY_LIMIT = 30;          // フォーム経由の1日の上限（全体）
const PER_EMAIL_DAILY_LIMIT = 3; // メールアドレスあたりの1日の上限（メール収集を有効にした場合）

// フォームの質問（タイトルは Issue テンプレートの見出しと一致させる＝Actions 側で同じように解析できる）
const Q = {
  name: "商品名",
  reg: "登録番号",
  maker: "メーカー名",
  crops: "使いたい作物・困っている虫や病気",
  notes: "自由記述",
};

/** 初回だけ実行: フォームを作り、送信トリガーを登録する */
function setup() {
  const form = FormApp.create("土にやさしい農薬チェッカー 判定リクエスト");
  form.setDescription(
    "まだ判定されていない農薬の判定をリクエストできます。送信すると自動で判定が始まり、" +
      "数分〜十数分後にサイトで商品名を検索すると結果が表示されます。\n" +
      "※ 農薬（殺虫剤・殺菌剤・除草剤など）の商品名のみ受け付けます。1回の送信につき1商品でお願いします。",
  );
  form.setCollectEmail(false);
  // API で作ったフォームは未公開（回答にログインが必要）になることがあるため明示的に公開する
  if (typeof form.setPublished === "function") form.setPublished(true);
  if (typeof form.setRequireLogin === "function") {
    try { form.setRequireLogin(false); } catch (_) { /* 個人アカウントでは不要 */ }
  }
  form.setConfirmationMessage(
    "リクエストを受け付けました。数分〜十数分後に、サイトで商品名を検索してください。\n" +
      "農薬の商品名として確認できなかった場合は掲載されません。",
  );
  form.addTextItem().setTitle(Q.name).setHelpText("製品ラベルに書かれている名前（例：ロハピ）").setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).build());
  form.addTextItem().setTitle(Q.reg).setHelpText("ラベルの「農林水産省登録第○○○○○号」の数字（わかれば）")
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern("^[0-9０-９]{0,6}$").setHelpText("数字6桁以内").build());
  form.addTextItem().setTitle(Q.maker).setHelpText("例：アース製薬（わかれば）");
  form.addParagraphTextItem().setTitle(Q.crops).setHelpText("例：ミニトマトのアブラムシ（その作物向けの使い方を優先して判定します）");
  form.addParagraphTextItem().setTitle(Q.notes);

  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("onFormSubmit").forForm(form).onFormSubmit().create();

  Logger.log("回答用URL（サイトのリクエストボタンに設定）: " + form.getPublishedUrl());
  Logger.log("編集用URL: " + form.getEditUrl());
  // 商品名の事前入力用（サイトで検索した語をフォームに引き継ぐ）
  const nameItem = form.getItems().find((i) => i.getTitle() === Q.name);
  const prefill = form.createResponse().withItemResponse(nameItem.asTextItem().createResponse("PREFILL")).toPrefilledUrl();
  Logger.log("事前入力URL（entry.xxx を REQUEST_FORM_NAME_ENTRY に設定）: " + prefill);
}

/** フォーム送信時: 回答を検査して Issue を作る */
function onFormSubmit(e) {
  const answers = {};
  e.response.getItemResponses().forEach((r) => (answers[r.getItem().getTitle()] = String(r.getResponse() || "")));

  const clean = (s, n) =>
    String(s || "")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/^#+/gm, "") // Markdown 見出しで本文の構造を壊されないように
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, n);

  const name = clean(answers[Q.name], 60);
  if (!name) return;

  // 回数制限（全体・メール単位）。詳細な入力チェックは Actions 側のゲートで行う
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd");
    const key = "count_" + today;
    const count = Number(props.getProperty(key) || 0);
    if (count >= DAILY_LIMIT) return console.warn("1日の上限に達したため Issue を作成しません");
    const email = e.response.getRespondentEmail && e.response.getRespondentEmail();
    if (email) {
      const ek = "email_" + today + "_" + Utilities.base64EncodeWebSafe(email);
      const ec = Number(props.getProperty(ek) || 0);
      if (ec >= PER_EMAIL_DAILY_LIMIT) return console.warn("メール単位の上限");
      props.setProperty(ek, String(ec + 1));
    }
    props.setProperty(key, String(count + 1));
  } finally {
    lock.releaseLock();
  }

  const field = (title, v) => `### ${title}\n\n${v || "_No response_"}\n`;
  const body = [
    field(Q.name, name),
    field(Q.reg, clean(answers[Q.reg], 10).replace(/[^0-9０-９]/g, "")),
    field(Q.maker, clean(answers[Q.maker], 60)),
    field(Q.crops, clean(answers[Q.crops], 200)),
    field("ラベル写真", ""),
    field(Q.notes, clean(answers[Q.notes], 400)),
    "<!-- Googleフォームから自動作成 -->",
  ].join("\n");

  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + props.getProperty("GITHUB_TOKEN"),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    payload: JSON.stringify({ title: `判定リクエスト: ${name}`, body, labels: LABELS }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) console.error("Issue 作成に失敗: " + res.getResponseCode() + " " + res.getContentText());
}
