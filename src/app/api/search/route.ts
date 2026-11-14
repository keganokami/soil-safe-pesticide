import { NextRequest, NextResponse } from "next/server";
import { searchByName } from "@/lib/famic";

export const runtime = "nodejs";
export const preferredRegion = "hnd1"; // FAMICへのアクセスは国内リージョンから

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > 60) {
    return NextResponse.json({ error: "商品名を入力してください（60文字以内）" }, { status: 400 });
  }
  try {
    const candidates = await searchByName(q);
    return NextResponse.json({ query: q, candidates });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "農薬登録情報提供システムへの問い合わせに失敗しました", detail: String(e) },
      { status: 502 },
    );
  }
}
