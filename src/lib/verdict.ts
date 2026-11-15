export type Level = "低" | "中" | "高" | "不明";

export type Verdict = {
  verdict: "許可" | "条件付き許可" | "不可" | "判定不能";
  summary: string;
  /** 利用者が必ず守るべき最重要の注意点（ファーストビューに表示）。古いデータには無い */
  keyCautions?: string[];
  product: {
    name: string;
    registrationNumber: string;
    registrant: string;
    pesticideType: string;
    activeIngredients: string[];
    isRegisteredPesticide: boolean;
  };
  soilAssessment: {
    persistence: { level: Level; detail: string };
    mobility: { level: Level; detail: string };
    soilOrganisms: { level: Level; detail: string };
    aquaticRiskOnSpill: { level: Level; detail: string };
  };
  reasons: string[];
  usage: {
    targetCropsAndPests: string;
    dilution: string;
    amountForPlot: string;
    timing: string;
    maxApplications: string;
    method: string;
    soilProtectionTips: string[];
    spillPrevention: string[];
  };
  alternatives: string[];
  sources: { title: string; url: string }[];
};

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;
const level = {
  type: "object",
  additionalProperties: false,
  required: ["level", "detail"],
  properties: {
    level: { type: "string", enum: ["低", "中", "高", "不明"], description: "リスクの大きさ" },
    detail: { type: "string", description: "根拠となる数値（DT50, Koc, LC50等）と出典の要約" },
  },
} as const;

/** submit_verdict ツールの入力スキーマ（strict tool use 用） */
export const VERDICT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "summary", "keyCautions", "product", "soilAssessment", "reasons", "usage", "alternatives", "sources"],
  properties: {
    verdict: { type: "string", enum: ["許可", "条件付き許可", "不可", "判定不能"] },
    summary: { type: "string", description: "判定の要旨（2〜3文）" },
    keyCautions: {
      ...strArr,
      description:
        "利用者が必ず守るべき最重要の注意点を3〜5個、重要な順に。各40字程度の短い命令形。許可でも必ず書く。不可・判定不能なら『使わない』とその要点",
    },
    product: {
      type: "object",
      additionalProperties: false,
      required: ["name", "registrationNumber", "registrant", "pesticideType", "activeIngredients", "isRegisteredPesticide"],
      properties: {
        name: str,
        registrationNumber: { type: "string", description: "農林水産省登録番号。無ければ空文字" },
        registrant: str,
        pesticideType: { type: "string", description: "農薬の種類・用途（例: 殺虫剤 乳剤）" },
        activeIngredients: { ...strArr, description: "有効成分名と濃度" },
        isRegisteredPesticide: { type: "boolean" },
      },
    },
    soilAssessment: {
      type: "object",
      additionalProperties: false,
      required: ["persistence", "mobility", "soilOrganisms", "aquaticRiskOnSpill"],
      properties: {
        persistence: { ...level, description: "土壌残留性" },
        mobility: { ...level, description: "土壌移動性・溶脱" },
        soilOrganisms: { ...level, description: "ミミズ・土壌微生物への影響" },
        aquaticRiskOnSpill: { ...level, description: "区画外にこぼれた場合の水生生物等への影響" },
      },
    },
    reasons: { ...strArr, description: "判定理由（不可の場合は特に具体的に）" },
    usage: {
      type: "object",
      additionalProperties: false,
      description: "許可/条件付き許可の場合の区画での使い方。不可・判定不能なら各項目は空文字/空配列",
      required: ["targetCropsAndPests", "dilution", "amountForPlot", "timing", "maxApplications", "method", "soilProtectionTips", "spillPrevention"],
      properties: {
        targetCropsAndPests: str,
        dilution: str,
        amountForPlot: { type: "string", description: "区画(2.25m²)あたりの散布液量・薬量と計算過程" },
        timing: str,
        maxApplications: str,
        method: str,
        soilProtectionTips: strArr,
        spillPrevention: strArr,
      },
    },
    alternatives: { ...strArr, description: "土壌に優しい代替手段（不要なら空配列）" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: { title: str, url: str },
      },
    },
  },
} as const;
