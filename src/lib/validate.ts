// ⑤ 画面側の検査: 配信データを信用せず、型が合わないものは表示しない
import type { IndexEntry, VerdictFile } from "./data";

const VERDICTS = ["許可", "条件付き許可", "不可", "判定不能"];
const LEVELS = ["低", "中", "高", "不明"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const ID_RE = /^(\d{1,6}|q-[0-9a-f]{10})$/;

export const isSafeId = (id: unknown): id is string => isStr(id) && ID_RE.test(id);

/** http/https 以外（javascript: など）のリンクは表示しない */
export function safeHref(u: unknown): string | null {
  if (!isStr(u) || u.length > 500) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isIndexEntry(e: unknown): e is IndexEntry {
  return (
    isObj(e) && isSafeId(e.id) && isStr(e.name) && isStr(e.query) && isStr(e.pesticideType) &&
    isStr(e.registrationNumber) && isStr(e.generatedAt) && VERDICTS.includes(e.verdict as string)
  );
}

export function isVerdictFile(d: unknown): d is VerdictFile {
  if (!isObj(d) || !isSafeId(d.id) || !isStr(d.generatedAt) || !isObj(d.verdict)) return false;
  const v = d.verdict;
  const p = v.product, u = v.usage, sa = v.soilAssessment;
  if (!VERDICTS.includes(v.verdict as string) || !isStr(v.summary) || !isObj(p) || !isObj(u) || !isObj(sa)) return false;
  if (!isStr(p.name) || !isStrArr(p.activeIngredients) || !isStrArr(v.reasons) || !isStrArr(v.alternatives)) return false;
  if (v.keyCautions !== undefined && !isStrArr(v.keyCautions)) return false;
  for (const k of ["persistence", "mobility", "soilOrganisms", "aquaticRiskOnSpill"]) {
    const a = sa[k];
    if (!isObj(a) || !LEVELS.includes(a.level as string) || !isStr(a.detail)) return false;
  }
  for (const k of ["targetCropsAndPests", "dilution", "amountForPlot", "timing", "maxApplications", "method"]) {
    if (!isStr(u[k])) return false;
  }
  if (!isStrArr(u.soilProtectionTips) || !isStrArr(u.spillPrevention) || !Array.isArray(v.sources)) return false;
  if (d.detail !== null && d.detail !== undefined && !(isObj(d.detail) && isStr(d.detail.url))) return false;
  return true;
}
