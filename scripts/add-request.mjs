// ① 入力ゲート（Issue 受付）
// Issue フォームの本文から商品名などを取り出して検査し、合格なら data/requests/<issue>.json に保存する。
// 1 Issue = 1 ファイルなので、同時に複数の Issue が来ても git の競合が起きない。
// GitHub Actions の出力: query（商品名。空なら不受理）, reject_reason
import { appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { checkProductName, cleanText, findNgWord } from "./guard.mjs";

const body = (process.env.ISSUE_BODY ?? "").slice(0, 20000);
const title = (process.env.ISSUE_TITLE ?? "").slice(0, 300);
const issue = Number(process.env.ISSUE_NUMBER ?? 0);
const out = process.env.GITHUB_OUTPUT;
const setOut = (k, v) => out && appendFileSync(out, `${k}=${String(v).replace(/[\r\n]/g, " ")}\n`);

/** "### 見出し" 単位で本文を分解 */
const sections = {};
for (const part of body.split(/^###\s+/m).slice(1)) {
  const [head, ...rest] = part.split("\n");
  const v = rest.join("\n").trim();
  sections[head.trim()] = v === "_No response_" ? "" : v;
}
const get = (label) => sections[label] ?? "";
// 複数行項目: 画像リンク・URL を除き、長さ制限
const multi = (s, n) => cleanText(s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/https?:\/\/\S+/g, ""), n).replace(/\s+/g, " ");

const reject = (reason) => {
  console.log(`不受理: ${reason}`);
  setOut("query", "");
  setOut("reject_reason", reason);
  process.exit(0);
};

if (!Number.isInteger(issue) || issue <= 0) reject("Issue番号が不正です");

const rawName = get("商品名") || title.replace(/^判定リクエスト[:：]\s*/, "");
const checked = checkProductName(rawName);
if (!checked.ok) reject(checked.reason);

const reg = cleanText(get("登録番号"), 20).replace(/\D/g, "").slice(0, 6);
const maker = cleanText(get("メーカー名"), 60).replace(/[\r\n]/g, " ");
const crops = multi(get("使いたい作物・困っている虫や病気"), 200);
const notes = multi(get("自由記述"), 400);
const ng = findNgWord([maker, crops, notes].join(" "), "input");
if (ng) reject("不適切な語句が含まれています");

const info = Object.fromEntries(
  Object.entries({ name: checked.name, reg, maker, crops, notes, issue }).filter(([, v]) => v),
);
mkdirSync("data/requests", { recursive: true });
writeFileSync(`data/requests/${issue}.json`, JSON.stringify(info, null, 2) + "\n");
console.log("受付:", info);
setOut("query", checked.name);
