// ハーネスの決定的チェック（AIを使わない）。Issue受付・生成・ビルドの全段で共通利用する。

/** 制御文字・HTMLタグを除去し、空白を詰めて長さ制限（表示用なので全角記号はそのまま＝NFC） */
export function cleanText(s, max) {
  if (typeof s !== "string") return "";
  return s
    .normalize("NFC")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

/** http/https のみ許可（javascript: data: などを排除） */
export function isSafeUrl(u) {
  if (typeof u !== "string" || u.length > 500) return false;
  try {
    const url = new URL(u);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

// 不適切な語。部分一致・正規化後で判定。運用で追記する。
// 出力用: 農薬の説明では「殺す」「毒」などが普通に出るため、差別・性的な語に限定
const NG_OUTPUT = [
  "ガイジ", "キチガイ", "シナ人", "ニガー", "nigger", "fuck", "porn", "レイプ", "セックス", "ちんこ", "まんこ",
];
// 入力用（商品名・Issue）: 出力用に加え、暴力・犯罪予告など
const NG_INPUT = [
  ...NG_OUTPUT,
  "死ね", "殺す", "殺害", "爆破", "テロ", "自殺", "おっぱい", "覚醒剤", "大麻", "麻薬", "毒殺", "サリン", "爆弾",
];
const normalizeForNg = (s) =>
  s.normalize("NFKC").toLowerCase().replace(/[\s・._\-ー~〜*]/g, "")
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)); // ひら→カナ
const prep = (list) => list.map((w) => [w, normalizeForNg(w)]);
const NG_SETS = { input: prep(NG_INPUT), output: prep(NG_OUTPUT) };

/** NGワードを含むか（含む場合はその語を返す）。mode: "input" | "output" */
export function findNgWord(text, mode = "input") {
  const t = normalizeForNg(String(text ?? ""));
  const hit = NG_SETS[mode].find(([, n]) => n && t.includes(n));
  return hit ? hit[0] : null;
}

/**
 * 商品名として受け付けられる入力か。
 * @returns {{ ok: true, name: string } | { ok: false, reason: string }}
 */
export function checkProductName(raw) {
  if (/[<>]/.test(String(raw ?? ""))) return { ok: false, reason: "HTMLや記号 < > は入力できません" };
  const name = cleanText(String(raw ?? ""), 200).normalize("NFKC").replace(/[\r\n]+/g, " ");
  if (!name) return { ok: false, reason: "商品名が空です" };
  if (name.length > 60) return { ok: false, reason: "商品名が長すぎます（60文字以内）" };
  if (/https?:|www\.|\.(com|net|org|jp|io|xyz|ru|cn)\b/i.test(name)) return { ok: false, reason: "URLは入力できません" };
  if (/@|[<>{}\[\]`$\\|;&]/.test(name)) return { ok: false, reason: "使用できない記号が含まれています" };
  if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z]/u.test(name)) return { ok: false, reason: "商品名として読み取れません" };
  if (/(.)\1{4,}/u.test(name)) return { ok: false, reason: "同じ文字の繰り返しは受け付けられません" };
  if (findNgWord(name)) return { ok: false, reason: "不適切な語句が含まれています" };
  return { ok: true, name: name.replace(/,/g, " ") };
}

const VERDICTS = ["許可", "条件付き許可", "不可", "判定不能"];
const LEVELS = ["低", "中", "高", "不明"];
const isStr = (v) => typeof v === "string";
const isStrArr = (v) => Array.isArray(v) && v.every(isStr);

/**
 * AI が出力した判定を検査・無害化する（出力ゲート）。
 * 不合格なら { ok:false, reason }、合格なら長さ制限・URL除外済みの判定を返す。
 */
export function sanitizeVerdict(v) {
  if (!v || typeof v !== "object") return { ok: false, reason: "判定が空です" };
  if (!VERDICTS.includes(v.verdict)) return { ok: false, reason: "判定区分が不正です" };
  const sa = v.soilAssessment ?? {};
  for (const k of ["persistence", "mobility", "soilOrganisms", "aquaticRiskOnSpill"]) {
    if (!sa[k] || !LEVELS.includes(sa[k].level) || !isStr(sa[k].detail)) return { ok: false, reason: `土壌評価(${k})が不正です` };
  }
  const p = v.product ?? {};
  const u = v.usage ?? {};
  if (!isStr(v.summary) || !isStr(p.name) || !isStrArr(p.activeIngredients) || !isStrArr(v.reasons)) {
    return { ok: false, reason: "必須項目の型が不正です" };
  }
  const t = (s, n) => cleanText(s, n);
  const arr = (a, n, len) => (isStrArr(a) ? a.map((s) => t(s, len)).filter(Boolean).slice(0, n) : []);
  const out = {
    verdict: v.verdict,
    summary: t(v.summary, 600),
    keyCautions: arr(v.keyCautions, 6, 120),
    product: {
      name: t(p.name, 80),
      registrationNumber: t(p.registrationNumber, 10).replace(/\D/g, ""),
      registrant: t(p.registrant, 120),
      pesticideType: t(p.pesticideType, 120),
      activeIngredients: arr(p.activeIngredients, 10, 120),
      isRegisteredPesticide: p.isRegisteredPesticide === true,
    },
    soilAssessment: Object.fromEntries(
      ["persistence", "mobility", "soilOrganisms", "aquaticRiskOnSpill"].map((k) => [k, { level: sa[k].level, detail: t(sa[k].detail, 800) }]),
    ),
    reasons: arr(v.reasons, 10, 400),
    usage: {
      targetCropsAndPests: t(u.targetCropsAndPests, 800),
      dilution: t(u.dilution, 300),
      amountForPlot: t(u.amountForPlot, 800),
      timing: t(u.timing, 300),
      maxApplications: t(u.maxApplications, 300),
      method: t(u.method, 800),
      soilProtectionTips: arr(u.soilProtectionTips, 8, 300),
      spillPrevention: arr(u.spillPrevention, 8, 300),
    },
    alternatives: arr(v.alternatives, 8, 300),
    sources: (Array.isArray(v.sources) ? v.sources : [])
      .filter((s) => s && isSafeUrl(s.url))
      .slice(0, 20)
      .map((s) => ({ title: t(s.title, 200), url: s.url })),
  };
  if (!out.summary || !out.product.name) return { ok: false, reason: "要旨または製品名が空です" };
  const ng = findNgWord(JSON.stringify(out), "output");
  if (ng) return { ok: false, reason: `出力に不適切な語句が含まれています（${ng}）` };
  return { ok: true, verdict: out };
}
