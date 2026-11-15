"use client";

import { useEffect, useMemo, useState } from "react";
import type { PesticideDetail } from "@/lib/famic";
import type { Verdict, Level } from "@/lib/verdict";
import type { IndexEntry, VerdictFile } from "@/lib/data";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "";

const VERDICT_STYLE: Record<Verdict["verdict"], { bg: string; chip: string; label: string; icon: string }> = {
  許可: { bg: "bg-emerald-600", chip: "bg-emerald-100 text-emerald-800", label: "使用OK", icon: "✓" },
  条件付き許可: { bg: "bg-amber-500", chip: "bg-amber-100 text-amber-800", label: "条件付きでOK", icon: "!" },
  不可: { bg: "bg-rose-600", chip: "bg-rose-100 text-rose-800", label: "使用NG", icon: "✕" },
  判定不能: { bg: "bg-stone-500", chip: "bg-stone-200 text-stone-700", label: "判定できません", icon: "?" },
};
const LEVEL_STYLE: Record<Level, string> = {
  低: "bg-emerald-100 text-emerald-800",
  中: "bg-amber-100 text-amber-800",
  高: "bg-rose-100 text-rose-800",
  不明: "bg-stone-200 text-stone-700",
};

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
// ひらがな→カタカナ（「ろはぴ」でも「ロハピ」に当たるように）
const kata = (s: string) => s.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/** タイムアウト付きで JSON を取得（固まったままにしない） */
async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: "no-cache", signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("タイムアウト");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export default function Home() {
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VerdictFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setError(null);
    fetchJson<IndexEntry[]>(`${BASE}/data/index.json`)
      .then(setIndex)
      .catch((e) => setError(`判定データを読み込めませんでした（${e.message}）`));
  }, [reloadKey]);

  const results = useMemo(() => {
    if (!index) return [];
    const q = kata(norm(query));
    if (!q) return index;
    return index.filter((e) =>
      [e.name, e.query, e.pesticideType, e.registrationNumber].some((f) => kata(norm(f)).includes(q)),
    );
  }, [index, query]);

  async function open(e: IndexEntry) {
    setError(null);
    setOpening(e.id);
    try {
      setSelected(await fetchJson<VerdictFile>(`${BASE}/data/verdicts/${e.id}.json`));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(`判定結果を読み込めませんでした（${(err as Error).message}）`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold tracking-widest text-emerald-700">SOIL-FRIENDLY CHECK</p>
        <h1 className="mt-1 text-3xl font-bold">土にやさしい農薬チェッカー</h1>
        <p className="mt-3 text-stone-600">
          農林水産省の農薬登録情報と専門機関の環境データをもとに、
          <strong>150cm×150cm・土の高さ約60cm</strong> の区画で土壌の活性を損なわずに使えるかを判定しています。
        </p>
      </header>

      {selected ? (
        <>
          <button onClick={() => setSelected(null)} className="text-sm text-emerald-700 underline">
            ← 一覧に戻る
          </button>
          <Result verdict={selected.verdict} detail={selected.detail} />
          <p className="mt-4 text-xs text-stone-500">
            判定日: {new Date(selected.generatedAt).toLocaleDateString("ja-JP")}（{selected.model}）
          </p>
        </>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="商品名で検索（例：ロハピ）"
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            maxLength={60}
          />
          {error && (
            <div className="mt-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
              <p>{error}</p>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-3 rounded-lg bg-rose-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-rose-800"
              >
                再読み込み
              </button>
            </div>
          )}
          {!index && !error && (
            <p className="mt-6 flex items-center gap-2 text-stone-500">
              <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-600" />
              判定データを読み込み中…
            </p>
          )}
          {index && (
            <section className="mt-6">
              {results.length > 0 ? (
                <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-300 bg-white">
                  {results.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => open(e)}
                        disabled={opening !== null}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-emerald-50 ${opening === e.id ? "animate-pulse bg-emerald-50" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className="font-bold">{e.name}</span>
                          <span className="ml-2 text-sm text-stone-500">{e.pesticideType}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${VERDICT_STYLE[e.verdict].chip}`}>
                          {VERDICT_STYLE[e.verdict].label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-stone-300 bg-white p-5">
                  <p>「{query}」はまだ判定されていません。</p>
                  <p className="mt-1 text-sm text-stone-600">判定は週1回まとめて追加されます。</p>
                  {REPO_URL && (
                    <a
                      href={`${REPO_URL}/issues/new?template=request.yml&title=${encodeURIComponent(`判定リクエスト: ${query}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block rounded-lg bg-stone-700 px-4 py-2 font-bold text-white hover:bg-stone-800"
                    >
                      判定をリクエストする（GitHub）
                    </a>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-stone-500">判定済み {index.length} 件</p>
            </section>
          )}
        </>
      )}

      <footer className="mt-16 border-t border-stone-300 pt-6 text-xs leading-relaxed text-stone-500">
        <p>
          登録情報の出典:{" "}
          <a className="underline" href="https://pesticide.maff.go.jp/" target="_blank" rel="noreferrer">
            農林水産省 農薬登録情報提供システム
          </a>
          。環境データはAIがWeb上の公的機関・メーカー・専門データベースを調査して要約したものです。
        </p>
        <p className="mt-2">
          本判定は参考情報です。使用前に必ず製品ラベルの用法・用量・使用上の注意を確認し、農薬取締法に従ってください。
        </p>
      </footer>
    </main>
  );
}

function Result({ verdict: v, detail }: { verdict: Verdict; detail: PesticideDetail | null }) {
  const s = VERDICT_STYLE[v.verdict];
  const showUsage = v.verdict === "許可" || v.verdict === "条件付き許可";
  const soil = [
    ["土壌残留性", v.soilAssessment.persistence],
    ["土壌移動性", v.soilAssessment.mobility],
    ["土壌生物への影響", v.soilAssessment.soilOrganisms],
    ["こぼれた時の影響", v.soilAssessment.aquaticRiskOnSpill],
  ] as const;

  return (
    <section className="mt-8 space-y-6">
      <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-sm">
        <div className={`${s.bg} flex items-center gap-4 px-6 py-5 text-white`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">{s.icon}</span>
          <div>
            <p className="text-sm opacity-90">{v.product.name}</p>
            <p className="text-2xl font-bold">
              {s.label}
              <span className="ml-2 text-base font-normal opacity-90">（{v.verdict}）</span>
            </p>
          </div>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="leading-relaxed">{v.summary}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-stone-600 sm:grid-cols-2">
            <div>
              登録番号: {v.product.registrationNumber || "なし"}
              {!v.product.isRegisteredPesticide && <span className="ml-1 text-rose-700">（農薬登録なし）</span>}
            </div>
            <div>種類: {v.product.pesticideType}</div>
            <div className="sm:col-span-2">有効成分: {v.product.activeIngredients.join("、")}</div>
            {v.product.registrant && <div className="sm:col-span-2">登録者: {v.product.registrant}</div>}
          </dl>
          {detail && (
            <a href={detail.url} target="_blank" rel="noreferrer" className="inline-block text-sm text-emerald-700 underline">
              農林水産省の登録情報（適用表 {detail.applicationTable.length} 件）を見る →
            </a>
          )}
        </div>
      </div>

      <Card title="土壌への影響評価">
        <ul className="space-y-3">
          {soil.map(([label, a]) => (
            <li key={label}>
              <div className="flex items-center gap-2">
                <span className="font-bold">{label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[a.level]}`}>{a.level}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">{a.detail}</p>
            </li>
          ))}
        </ul>
      </Card>

      {v.reasons.length > 0 && (
        <Card title={v.verdict === "不可" ? "使用できない理由" : "判定理由"}>
          <Bullets items={v.reasons} />
        </Card>
      )}

      {showUsage && (
        <Card title="この区画（150×150cm）での使い方">
          <dl className="space-y-3 text-sm">
            {[
              ["対象作物・病害虫", v.usage.targetCropsAndPests],
              ["希釈倍数", v.usage.dilution],
              ["区画あたりの量", v.usage.amountForPlot],
              ["使用時期", v.usage.timing],
              ["使用回数", v.usage.maxApplications],
              ["使用方法", v.usage.method],
            ]
              .filter(([, val]) => val)
              .map(([k, val]) => (
                <div key={k} className="grid grid-cols-1 gap-1 sm:grid-cols-[9rem_1fr]">
                  <dt className="font-bold text-stone-600">{k}</dt>
                  <dd className="leading-relaxed whitespace-pre-wrap">{val}</dd>
                </div>
              ))}
          </dl>
          {v.usage.soilProtectionTips.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-1 font-bold text-emerald-800">土壌を守るためのポイント</h4>
              <Bullets items={v.usage.soilProtectionTips} />
            </div>
          )}
          {v.usage.spillPrevention.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1 font-bold text-amber-800">区画外へのこぼれ・流出対策</h4>
              <Bullets items={v.usage.spillPrevention} />
            </div>
          )}
        </Card>
      )}

      {v.alternatives.length > 0 && (
        <Card title="土にやさしい代替案">
          <Bullets items={v.alternatives} />
        </Card>
      )}

      {v.sources.length > 0 && (
        <Card title="参照した情報源">
          <ul className="space-y-1 text-sm">
            {v.sources.map((src) => (
              <li key={src.url} className="break-all">
                <a href={src.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                  {src.title || src.url}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-300 bg-white px-6 py-5">
      <h3 className="mb-3 text-lg font-bold">{title}</h3>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
