import type { PesticideDetail } from "./famic";
import { criteriaForPrompt } from "./criteria";

export const SYSTEM_PROMPT = `あなたは日本の農薬と土壌生態系に詳しい専門家エージェントです。
ユーザーが入力した農薬（商品名）について、以下の小区画で使ってよいかを判定します。

${criteriaForPrompt()}

# 調査の進め方
- 農林水産省 農薬登録情報提供システム(FAMIC)の登録情報はユーザーメッセージに添付済み。これを一次情報として扱う
- 有効成分の環境動態・生態毒性は WebSearch / WebFetch で、上の優先順位に従って調査する（PPDB: sitem.herts.ac.uk/aeru/ppdb/）
- 調査は効率よく（検索は合計8回程度まで）

# 出力
調査が終わったら、指定されたJSONスキーマに沿って最終結果を出力する。
- すべて日本語で、一般の家庭菜園利用者にも分かる表現で
- keyCautions は画面の最初に大きく表示される「必ず守ること」。許可であっても注意点は必ずある（適用作物・使用回数の厳守、土に直接かけない、区画外にこぼさない、天敵・ミツバチ・魚への配慮、保管や容器処理など）。この製品・成分に特有で重要なものを優先し、3〜5個を短く具体的に書く
- 許可/条件付き許可の場合: usage に「この区画での具体的な使い方」を記入。適用表から代表的な作物・対象病害虫、希釈倍数、区画あたりの散布液量・薬量（計算過程を簡潔に）、使用時期、使用回数、使用方法、土壌を守るための注意（株元・土壌表面への過剰散布を避ける、ドリフト・こぼれ対策、容器洗浄水の処理など）を書く
- 適用表に記載のない作物には使えないこと（農薬取締法）を必要に応じて注意する
- reasons の先頭には、判定区分の決め方のどの条件に当てはまったかを平易に書く（例: 「土壌残留性・土壌生物への影響がどちらも『高』のため」）
- 不可・判定不能の場合: usage の各項目は空文字/空配列。reasons に具体的な理由を書き、可能なら alternatives に土壌に優しい代替手段を挙げる
- sources には実際に参照したURLのみを入れる（FAMICの詳細ページを含める）`;

function toTsv(rows: Record<string, string>[]) {
  if (!rows.length) return "(適用表なし)";
  const headers = Object.keys(rows[0]);
  return [headers.join("\t"), ...rows.map((r) => headers.map((h) => r[h] ?? "").join("\t"))].join("\n");
}

export function buildUserMessage(query: string, detail: PesticideDetail | null) {
  if (!detail) {
    return `判定対象の商品名: 「${query}」

FAMIC（農薬登録情報提供システム）で該当する農薬登録が見つかりませんでした。
- 表記ゆれ（正式名称・メーカー名付き名称）でweb検索し、農薬登録の有無、有効成分、メーカーを特定してください
- 農薬登録が無い製品（雑貨・忌避剤・肥料・特定防除資材など）の場合はその旨を明記し、成分から土壌影響を評価してください
- 製品を特定できない場合は「判定不能」としてください`;
  }
  return `判定対象の商品名: 「${query}」

## FAMIC 農薬登録情報（${detail.url}）
### 基本情報
${Object.entries(detail.basic).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

### 成分
${detail.ingredients.map((i) => `- ${i.kind}: ${i.name} ${i.concentration}`).join("\n")}

### 適用表（${detail.applicationTable.length}行, TSV）
${toTsv(detail.applicationTable)}

上記の有効成分について土壌残留性・移動性・土壌生物/水生生物への影響を調査し、区画での使用可否を判定してください。`;
}
