// 生成結果(RESULT_FILE)から Issue への返信本文(reply.md)を作る。
// 出力: outcome = published | ambiguous | rejected | failed
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";

const query = process.env.QUERY ?? "";
const siteUrl = process.env.SITE_URL ?? "";
const rejectReason = process.env.REJECT_REASON ?? "";
const resultFile = process.env.RESULT_FILE ?? "";
let results = [];
try {
  results = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, "utf8")) : [];
} catch {
  results = [];
}
const r = results.find((x) => x.query === query);
const LABEL = { 許可: "使用OK", 条件付き許可: "条件付きOK", 不可: "使用NG", 判定不能: "判定不能" };

let body;
let outcome;
if (!query) {
  outcome = "rejected";
  body = `このリクエストは受け付けられませんでした（${rejectReason || "入力内容を確認できませんでした"}）。\n\nこのサービスは、日本で販売されている**農薬の商品名**の判定専用です。商品名を確認のうえ、新しくIssueを立ててください。`;
} else if (r && (r.status === "generated" || r.status === "skipped")) {
  outcome = "published";
  const url = `${siteUrl}?id=${encodeURIComponent(r.id)}`;
  body = `「${query}」の判定が${r.status === "skipped" ? "すでにあります" : "完了しました"}。\n\n**判定: ${LABEL[r.verdict] ?? r.verdict}**\n\n結果ページ（注意点・使い方・出典）: ${url}\n\n※ サイトへの反映には数分かかることがあります。`;
} else if (r && r.status === "ambiguous") {
  outcome = "ambiguous";
  body = `「${query}」に当てはまる製品が複数見つかりました。下の候補から**登録番号**を選び、このIssueを編集して「登録番号」欄に数字を入れてください。編集すると自動で再判定します。\n\n${(r.candidates ?? []).slice(0, 10).map((c) => { const [n, no] = String(c).split(","); return `- ${n}（登録番号 ${no}）`; }).join("\n")}`;
} else if (r && r.status === "rejected") {
  outcome = "rejected";
  body = `「${query}」は判定の対象外と判断しました（${r.message ?? "農薬の商品名として確認できませんでした"}）。サイトには掲載しません。\n\nこのサービスは、日本で販売されている**農薬・園芸資材の商品名**の判定専用です。正しい商品名がわかる場合は、ラベルの登録番号を添えて新しくIssueを立ててください。`;
} else {
  outcome = "failed";
  body = `「${query}」の判定中にエラーが発生しました。管理者が確認します。`;
}

writeFileSync("reply.md", body);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `outcome=${outcome}\n`);
console.log(outcome, "\n" + body);
