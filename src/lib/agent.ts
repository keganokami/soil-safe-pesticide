import Anthropic from "@anthropic-ai/sdk";
import type { PesticideDetail } from "./famic";
import { PLOT } from "./plot";
import { VERDICT_JSON_SCHEMA, type Verdict } from "./verdict";

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 12;

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "search"; query: string }
  | { type: "fetch"; url: string }
  | { type: "source"; title: string; url: string }
  | { type: "verdict"; verdict: Verdict }
  | { type: "error"; message: string };

const SYSTEM = `あなたは日本の農薬と土壌生態系に詳しい専門家エージェントです。
ユーザーが入力した農薬（商品名）について、以下の小区画で使ってよいかを判定します。

# 区画条件
- 区画: ${PLOT.widthCm}cm × ${PLOT.depthCm}cm（面積 ${PLOT.areaM2} m²）、土の高さ約 ${PLOT.heightCm}cm（土量 約 ${PLOT.volumeM3} m³）
- 雨で流出する構造ではないが、万一こぼれて区画外に流れた場合（周辺の土壌・排水・水路）への影響もある程度避けたい
- 10a(1000m²)あたりの量 × ${PLOT.factorPer10a} = 区画あたりの量

# 判定基準
目的は「土壌に影響がない」または「使用制限・用法を守ることで土壌の持続的な活性（微生物・ミミズ等の土壌生物、団粒構造、有機物分解）を担保できる」ことです。
次の観点を、信頼できる情報源で確認して評価してください。
1. 土壌残留性: 土壌中半減期(DT50)。目安: <30日=低, 30〜100日=中, >100日=高。土壌残留性農薬・作物残留性農薬の指定の有無
2. 土壌移動性: Koc / GUS指数（浸透・流亡しやすさ）
3. 土壌生物への影響: ミミズ急性/慢性毒性、土壌微生物（窒素・炭素無機化）への影響、有用天敵・ハチへの影響も参考
4. 流出時のリスク: 水産動植物(魚類・甲殻類・藻類)への毒性。ラベルの「水産動植物に影響」等の注意事項
5. 作用様式: 土壌くん蒸剤・土壌消毒剤（クロルピクリン、D-D、ダゾメット、カーバム等）や土壌処理型の除草剤・殺菌剤は土壌生物相を大きく損なうため原則不可
6. 天然物由来・食品成分由来・特定防除資材など、速やかに分解され土壌影響が小さいものは許可寄り

判定区分:
- "許可": 土壌への影響が無視できるレベル
- "条件付き許可": 用法・使用回数・量・散布方法（土壌に直接かけない等）を守れば土壌活性を維持できる
- "不可": 用法を守っても土壌生物・土壌残留・流出時の影響が大きい
- "判定不能": 信頼できる情報が見つからない、または商品を特定できない

# 情報源と調査の進め方
- 農林水産省 農薬登録情報提供システム(FAMIC)の登録情報はユーザーメッセージに添付済み。これを一次情報として扱う
- 有効成分の環境動態・生態毒性は web_search / web_fetch で調査する。優先順位:
  (1) 農林水産省・FAMIC・環境省（農薬の登録基準・水産動植物の被害防止に係る基準値、評価書）・食品安全委員会の評価書
  (2) メーカー公式サイト（製品ページ、ラベル、SDS）
  (3) PPDB (University of Hertfordshire Pesticide Properties DataBase, sitem.herts.ac.uk/aeru/ppdb/)、EFSA、US EPA
  (4) JA・都道府県の農業試験場・大学などの専門サイト
- 通販サイトやまとめブログを根拠にしない
- 調査は効率よく（検索は合計8回程度まで）。見つからない値は推測せず「不明」と書く

# 出力
調査が終わったら必ず submit_verdict ツールを1回だけ呼び出して結果を提出する（それ以外の最終回答テキストは不要）。
- すべて日本語で、一般の家庭菜園利用者にも分かる表現で
- 許可/条件付き許可の場合: usage に「この区画での具体的な使い方」を記入。適用表から代表的な作物・対象病害虫、希釈倍数、区画あたりの散布液量・薬量（計算過程を簡潔に）、使用時期、使用回数、使用方法、土壌を守るための注意（株元・土壌表面への過剰散布を避ける、ドリフト・こぼれ対策、容器洗浄水の処理など）を書く
- 適用表に記載のない作物には使えないこと（農薬取締法）を必要に応じて注意する
- 不可の場合: reasons に具体的な理由を書き、可能なら alternatives に土壌に優しい代替手段を挙げる
- sources には実際に参照したURLのみを入れる（FAMICの詳細ページを含める）`;

const SUBMIT_TOOL: Anthropic.Beta.BetaTool = {
  name: "submit_verdict",
  description:
    "調査結果に基づく最終判定を提出する。調査完了後に必ず1回だけ呼び出す。",
  input_schema: VERDICT_JSON_SCHEMA as Anthropic.Beta.BetaTool.InputSchema,
  strict: true,
};

const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 8 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
  SUBMIT_TOOL,
];

function toTsv(rows: Record<string, string>[]) {
  if (!rows.length) return "(適用表なし)";
  const headers = Object.keys(rows[0]);
  return [headers.join("\t"), ...rows.map((r) => headers.map((h) => r[h] ?? "").join("\t"))].join("\n");
}

function buildUserMessage(query: string, detail: PesticideDetail | null) {
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

export async function runAgent(
  query: string,
  detail: PesticideDetail | null,
  emit: (e: AgentEvent) => void,
): Promise<Verdict | null> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: buildUserMessage(query, detail) },
  ];
  const seen = new Set<string>();
  let nudged = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    emit({ type: "status", message: turn === 0 ? "AIが有効成分の環境影響を調査しています…" : "調査を続けています…" });

    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM,
      tools: TOOLS,
      messages,
      output_config: { effort: "high" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    // 進捗: サーバーツールの呼び出しと検索結果をリアルタイムに通知
    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use") {
        const input = block.input as { query?: string; url?: string };
        if (block.name === "web_search" && input.query) emit({ type: "search", query: input.query });
        if (block.name === "web_fetch" && input.url) emit({ type: "fetch", url: input.url });
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result" && !seen.has(r.url)) {
            seen.add(r.url);
            emit({ type: "source", title: r.title, url: r.url });
          }
        }
      }
    });

    const response = await stream.finalMessage();

    if (response.stop_reason === "refusal") {
      emit({ type: "error", message: "AIが回答を拒否しました。別の商品名でお試しください。" });
      return null;
    }

    const submit = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "submit_verdict",
    );
    if (submit) {
      const verdict = submit.input as Verdict;
      emit({ type: "verdict", verdict });
      return verdict;
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue; // サーバーツールのループ継続

    if (response.stop_reason === "max_tokens") {
      emit({ type: "error", message: "出力が長すぎて途中で打ち切られました。もう一度お試しください。" });
      return null;
    }

    // 他のツール呼び出し（想定外）には結果を返す
    const otherToolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (otherToolUses.length) {
      messages.push({
        role: "user",
        content: otherToolUses.map((t) => ({
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: "このツールは存在しません。submit_verdict を使ってください。",
          is_error: true,
        })),
      });
      continue;
    }

    if (nudged) break;
    nudged = true;
    messages.push({
      role: "user",
      content: "調査結果を submit_verdict ツールで提出してください。",
    });
  }

  emit({ type: "error", message: "判定結果を取得できませんでした。時間をおいて再度お試しください。" });
  return null;
}
