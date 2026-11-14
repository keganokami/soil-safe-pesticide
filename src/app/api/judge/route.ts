import { NextRequest } from "next/server";
import { getDetail, type PesticideDetail } from "@/lib/famic";
import { runAgent, type AgentEvent } from "@/lib/agent";
import type { Verdict } from "@/lib/verdict";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";
export const maxDuration = 300;

// 同一インスタンス内の簡易キャッシュ（24時間）
const cache = new Map<string, { at: number; verdict: Verdict; detail: PesticideDetail | null }>();
const TTL = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (passcode && req.headers.get("x-app-passcode") !== passcode) {
    return Response.json({ error: "パスコードが違います" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { query?: string; registrationNumber?: string | null };
  const query = body.query?.trim() ?? "";
  const regNo = body.registrationNumber?.trim() || null;
  if (!query || query.length > 60) return Response.json({ error: "商品名が不正です" }, { status: 400 });
  if (regNo && !/^\d{1,6}$/.test(regNo)) return Response.json({ error: "登録番号が不正です" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent | { type: "detail"; detail: PesticideDetail | null } | { type: "done" }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const key = regNo ?? `q:${query}`;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL) {
          send({ type: "detail", detail: hit.detail });
          send({ type: "status", message: "キャッシュ済みの判定結果を表示します" });
          send({ type: "verdict", verdict: hit.verdict });
          return;
        }

        let detail: PesticideDetail | null = null;
        if (regNo) {
          send({ type: "status", message: `農薬登録情報（登録番号 ${regNo}）を取得しています…` });
          detail = await getDetail(regNo);
        }
        send({ type: "detail", detail });

        const verdict = await runAgent(query, detail, send);
        if (verdict) cache.set(key, { at: Date.now(), verdict, detail });
      } catch (e) {
        console.error(e);
        send({ type: "error", message: `エラーが発生しました: ${e instanceof Error ? e.message : String(e)}` });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
