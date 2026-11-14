// Issue フォームの本文から商品名（と登録番号）を取り出して data/products.txt に追記する
import { appendFileSync, readFileSync } from "node:fs";

const body = process.env.ISSUE_BODY ?? "";
const title = process.env.ISSUE_TITLE ?? "";

const section = (label) => {
  const m = body.match(new RegExp(`###\\s*${label}[^\\n]*\\n+([^\\n#]+)`));
  const v = m?.[1]?.trim() ?? "";
  return v === "_No response_" ? "" : v;
};

const clean = (s) =>
  s.normalize("NFKC").replace(/[\r\n#,`$\\<>|;&]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

let name = clean(section("商品名") || title.replace(/^判定リクエスト[:：]\s*/, ""));
const reg = clean(section("登録番号")).replace(/\D/g, "").slice(0, 6);

const out = process.env.GITHUB_OUTPUT;
if (!name) {
  console.log("商品名が見つかりません");
  if (out) appendFileSync(out, "name=\n");
  process.exit(0);
}
const line = reg ? `${name},${reg}` : name;
const list = readFileSync("data/products.txt", "utf8").split("\n").map((l) => l.trim());
if (!list.includes(line)) appendFileSync("data/products.txt", `${line}\n`);
console.log(`追加: ${line}`);
if (out) appendFileSync(out, `name=${line}\n`);
