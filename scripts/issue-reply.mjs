// 生成結果(RESULT_FILE)から Issue への返信本文を作る。出力: body(ファイル), close(true/false), label
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";

const query = process.env.QUERY;
const siteUrl = process.env.SITE_URL;
const repoUrl = process.env.REPO_URL;
const results = existsSync(process.env.RESULT_FILE) ? JSON.parse(readFileSync(process.env.RESULT_FILE, "utf8")) : [];
const r = results.find((x) => x.query === query);

const LABEL = { 許可: "使用OK", 条件付き許可: "条件付きOK", 不可: "使用NG", 判定不能: "判定不能" };
let body;
let close = false;
let label = "";

if (r && (r.status === "generated" || r.status === "skipped")) {
  const url = `${siteUrl}?id=${encodeURIComponent(r.id)}`;
  body = `「${query}」の判定が${r.status === "skipped" ? "すでにあります" : "完了しました"}。\n\n**判定: ${LABEL[r.verdict] ?? r.verdict}**\n\n結果ページ（注意点・使い方・出典）: ${url}\n\n※ サイトへの反映には数分かかることがあります。`;
  close = true;
} else if (r && r.status === "ambiguous") {
  body = `「${query}」に当てはまる製品が複数見つかりました。下の候補から**登録番号**を選び、このIssueを編集するか新しくIssueを立て直してください（登録番号の欄に数字を入れると特定できます）。\n\n${r.candidates.map((c) => { const [n, no] = c.split(","); return `- ${n}（登録番号 ${no}）`; }).join("\n")}`;
  label = "要確認";
} else {
  body = `「${query}」の判定に失敗しました。${r?.message ? `\n\n理由: ${r.message}` : ""}\n\n時間をおいて自動で再実行されるか、管理者が確認します。`;
  label = "要確認";
}

writeFileSync("reply.md", body);
appendFileSync(process.env.GITHUB_OUTPUT, `close=${close}\nlabel=${label}\n`);
console.log(body);
