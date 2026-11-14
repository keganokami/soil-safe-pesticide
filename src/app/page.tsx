"use client";

import { useRef, useState } from "react";
import type { Candidate, PesticideDetail } from "@/lib/famic";
import type { Verdict, Level } from "@/lib/verdict";

type Log = { kind: "status" | "search" | "fetch" | "error"; text: string };

const VERDICT_STYLE: Record<Verdict["verdict"], { bg: string; label: string; icon: string }> = {
  許可: { bg: "bg-emerald-600", label: "使用OK", icon: "✓" },
  条件付き許可: { bg: "bg-amber-500", label: "条件付きでOK", icon: "!" },
  不可: { bg: "bg-rose-600", label: "使用NG", icon: "✕" },
  判定不能: { bg: "bg-stone-500", label: "判定できません", icon: "?" },
};
const LEVEL_STYLE: Record<Level, string> = {
  低: "bg-emerald-100 text-emerald-800",
  中: "bg-amber-100 text-amber-800",
  高: "bg-rose-100 text-rose-800",
  不明: "bg-stone-200 text-stone-700",
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [detail, setDetail] = useState<PesticideDetail | null | undefined>(undefined);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setCandidates(null);
    setLogs([]);
    setDetail(undefined);
    setVerdict(null);
    setError(null);
  };

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    abortRef.current?.abort();
    reset();
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "検索に失敗しました");
      const list: Candidate[] = data.candidates;
      const exact = list.filter((c) => c.name === q.normalize("NFKC"));
      if (list.length === 1 || exact.length === 1) {
        await judge(q, (exact[0] ?? list[0]).registrationNumber);
      } else {
        setCandidates(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function judge(q: string, registrationNumber: string | null) {
    setCandidates(null);
    setRunning(true);
    setLogs([]);
    setVerdict(null);
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-passcode": passcode },
        body: JSON.stringify({ query: q, registrationNumber }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "");
          if (!line) continue;
          const ev = JSON.parse(line);
          switch (ev.type) {
            case "status":
              setLogs((l) => [...l, { kind: "status", text: ev.message }]);
              break;
            case "search":
              setLogs((l) => [...l, { kind: "search", text: ev.query }]);
              break;
            case "fetch":
              setLogs((l) => [...l, { kind: "fetch", text: ev.url }]);
              break;
            case "detail":
              setDetail(ev.detail);
              break;
            case "verdict":
              setVerdict(ev.verdict);
              break;
            case "error":
              setError(ev.message);
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold tracking-widest text-emerald-700">SOIL-FRIENDLY CHECK</p>
        <h1 className="mt-1 text-3xl font-bold">土にやさしい農薬チェッカー</h1>
        <p className="mt-3 text-stone-600">
          農薬の商品名を入力すると、農林水産省の農薬登録情報と専門機関の環境データをAIが調べ、
          <strong>150cm×150cm・土の高さ約60cm</strong> の区画で土壌の活性を損なわずに使えるかを判定します。
        </p>
      </header>

      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="商品名（例：ロハピ）"
          className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
          maxLength={60}
          disabled={running}
        />
        <button
          type="submit"
          disabled={running || searching || !query.trim()}
          className="rounded-xl bg-emerald-700 px-6 py-3 text-lg font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {searching ? "検索中…" : running ? "判定中…" : "判定する"}
        </button>
      </form>
      <details className="mt-2 text-sm text-stone-500">
        <summary className="cursor-pointer">パスコード（設定されている場合）</summary>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="mt-2 rounded-lg border border-stone-300 bg-white px-3 py-1"
        />
      </details>

      {error && <div className="mt-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">{error}</div>}

      {candidates && (
        <section className="mt-8">
          {candidates.length === 0 ? (
            <div className="rounded-xl border border-stone-300 bg-white p-5">
              <p>農薬登録情報に「{query}」は見つかりませんでした。</p>
              <p className="mt-1 text-sm text-stone-600">
                登録の無い製品（忌避剤・資材など）や表記違いの可能性があります。Web情報からAIに調べさせることもできます。
              </p>
              <button
                onClick={() => judge(query.trim(), null)}
                className="mt-4 rounded-lg bg-stone-700 px-4 py-2 font-bold text-white hover:bg-stone-800"
              >
                Web情報で判定する
              </button>
            </div>
          ) : (
            <>
              <h2 className="mb-3 font-bold">候補が {candidates.length} 件あります。対象の製品を選んでください</h2>
              <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-300 bg-white">
                {candidates.map((c) => (
                  <li key={c.registrationNumber}>
                    <button
                      onClick={() => judge(c.name, c.registrationNumber)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-emerald-50"
                    >
                      <span>
                        <span className="font-bold">{c.name}</span>
                        <span className="ml-2 text-sm text-stone-500">{c.type}</span>
                      </span>
                      <span className="shrink-0 text-xs text-stone-500">登録第{c.registrationNumber}号</span>
                    </button>
                  </li>
                ))}
              </ul>
              {candidates.length >= 20 && (
                <p className="mt-2 text-sm text-stone-500">候補が多いため先頭20件のみ表示しています。正式名称で絞り込んでください。</p>
              )}
            </>
          )}
        </section>
      )}

      {(running || logs.length > 0) && !verdict && (
        <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            {running && <span className="h-3 w-3 animate-ping rounded-full bg-emerald-600" />}
            調査の進行状況
          </h2>
          <p className="mb-3 text-sm text-stone-500">Web調査を含むため1〜3分ほどかかります。</p>
          <ol className="space-y-1 text-sm">
            {logs.map((l, i) => (
              <li key={i} className="break-all">
                {l.kind === "search" && <>🔎 検索: {l.text}</>}
                {l.kind === "fetch" && <>📄 参照: {l.text}</>}
                {l.kind === "status" && <>・{l.text}</>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {verdict && <Result verdict={verdict} detail={detail ?? null} />}

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
