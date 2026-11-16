// ④ 公開ゲート: public/data/verdicts/*.json を検査し、合格したものだけで index.json を作る。
// ビルド前（prebuild / predev）に毎回実行する。不合格ファイルは公開物から除外する。
import { readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { sanitizeVerdict, cleanText } from "./guard.mjs";

const DIR = "public/data/verdicts";
const ID_RE = /^(\d{1,6}|q-[0-9a-f]{10})$/;
const index = [];
const rejected = [];

for (const f of existsSync(DIR) ? readdirSync(DIR) : []) {
  if (!f.endsWith(".json")) continue;
  const id = f.slice(0, -5);
  const full = path.join(DIR, f);
  try {
    if (!ID_RE.test(id)) throw new Error("ファイル名が不正");
    const data = JSON.parse(readFileSync(full, "utf8"));
    if (data.id !== id) throw new Error("id がファイル名と一致しない");
    if (Number.isNaN(Date.parse(data.generatedAt))) throw new Error("generatedAt が不正");
    const checked = sanitizeVerdict(data.verdict);
    if (!checked.ok) throw new Error(checked.reason);
    // CI のビルドでは無害化済みの判定で上書きしたものを配信する（手元の原本は書き換えない）
    if (process.env.CI) writeFileSync(full, JSON.stringify({ ...data, verdict: checked.verdict }, null, 2) + "\n");
    const v = checked.verdict;
    index.push({
      id,
      query: cleanText(data.query, 60),
      name: cleanText(data.detail?.name ?? v.product.name, 80),
      registrationNumber: cleanText(data.detail?.registrationNumber ?? v.product.registrationNumber, 10),
      pesticideType: cleanText(data.detail?.basic?.["農薬の種類"] ?? v.product.pesticideType, 120),
      verdict: v.verdict,
      generatedAt: data.generatedAt,
    });
  } catch (e) {
    rejected.push(`${f}: ${e.message}`);
    // ビルド成果物から外す（out/ に混ざらないよう public からも除去。git 上の原本は残る）
    if (process.env.CI) rmSync(full);
  }
}

index.sort((a, b) => a.name.localeCompare(b.name, "ja"));
writeFileSync("public/data/index.json", JSON.stringify(index, null, 2) + "\n");
console.log(`index.json: ${index.length} 件を公開${rejected.length ? ` / 除外 ${rejected.length} 件:\n  ${rejected.join("\n  ")}` : ""}`);
