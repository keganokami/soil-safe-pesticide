// Issue フォームの本文から商品名などを取り出し、
//   data/products.txt に「商品名[,登録番号]」を追記
//   data/requests.json に補足（メーカー・作物・自由記述）を保存
// する。GitHub Actions の出力に name / query を返す。
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const body = process.env.ISSUE_BODY ?? "";
const title = process.env.ISSUE_TITLE ?? "";
const issue = Number(process.env.ISSUE_NUMBER ?? 0);

/** "### 見出し" 単位で本文を分解 */
const sections = {};
for (const part of body.split(/^###\s+/m).slice(1)) {
  const [head, ...rest] = part.split("\n");
  const v = rest.join("\n").trim();
  sections[head.trim()] = v === "_No response_" ? "" : v;
}
const get = (label) => sections[label] ?? "";

// 1行項目: 改行・区切り文字・制御文字を除去
const oneLine = (s, n) =>
  s.normalize("NFKC").replace(/[\r\n#,`$\\<>|;&]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
// 複数行項目: 画像リンクやHTMLを除き、長さを制限
const multi = (s, n) =>
  s.normalize("NFKC").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);

const name = oneLine(get("商品名") || title.replace(/^判定リクエスト[:：]\s*/, ""), 60);
const reg = oneLine(get("登録番号"), 20).replace(/\D/g, "").slice(0, 6);
const maker = oneLine(get("メーカー名"), 60);
const crops = multi(get("使いたい作物・困っている虫や病気"), 200);
const notes = multi(get("自由記述"), 400);

const out = process.env.GITHUB_OUTPUT;
const setOut = (k, v) => out && appendFileSync(out, `${k}=${v}\n`);

if (!name) {
  console.log("商品名が見つかりません");
  setOut("name", "");
  process.exit(0);
}

const line = reg ? `${name},${reg}` : name;
const list = readFileSync("data/products.txt", "utf8").split("\n").map((l) => l.trim());
if (!list.includes(line)) appendFileSync("data/products.txt", `${line}\n`);

const reqPath = "data/requests.json";
const reqs = existsSync(reqPath) ? JSON.parse(readFileSync(reqPath, "utf8")) : {};
const info = Object.fromEntries(Object.entries({ maker, crops, notes, issue }).filter(([, v]) => v));
reqs[name] = { ...(reqs[name] ?? {}), ...info };
writeFileSync(reqPath, JSON.stringify(reqs, null, 2) + "\n");

console.log(`追加: ${line}`, info);
setOut("name", line);
setOut("query", name);
