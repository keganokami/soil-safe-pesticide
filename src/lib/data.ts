import type { PesticideDetail } from "./famic";
import type { Verdict } from "./verdict";

/** public/data/index.json の1行 */
export type IndexEntry = {
  id: string; // 登録番号 or "q-<hash>"（未登録品）
  query: string; // products.txt に書かれた名前
  name: string; // 正式な農薬の名称
  registrationNumber: string;
  pesticideType: string;
  verdict: Verdict["verdict"];
  generatedAt: string; // ISO8601
};

/** public/data/verdicts/<id>.json */
export type VerdictFile = {
  id: string;
  query: string;
  generatedAt: string;
  model: string;
  detail: PesticideDetail | null;
  verdict: Verdict;
};
