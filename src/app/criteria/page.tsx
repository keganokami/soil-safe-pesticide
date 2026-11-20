import type { Metadata } from "next";
import Link from "next/link";
import { AXES, CRITERIA_VERSION, GOAL, PLOT_TEXT, SOURCES, SOURCE_RULES, VERDICT_RULES } from "@/lib/criteria";
import { LEVEL_STYLE, VerdictChip } from "@/components/verdict-style";
import { ChevronLeft } from "@/components/icons";

export const metadata: Metadata = {
  title: "判定基準 | 土にやさしい農薬チェッカー",
  description: "AIが農薬の使用可否を判定するときの基準（評価項目・しきい値・判定区分・情報源）",
};

export default function CriteriaPage() {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Link href="/" className="-ml-2 flex min-h-11 items-center gap-1 rounded-xl px-2 font-bold text-primary">
            <ChevronLeft className="h-5 w-5" />
            一覧へ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 pt-5 pb-12">
        <section>
          <h1 className="text-2xl font-bold text-primary-strong">判定基準</h1>
          <p className="mt-1 text-xs text-muted">第{CRITERIA_VERSION}版。AIはこの基準どおりに調査・判定するよう指示されています。</p>
          <p className="mt-4 rounded-2xl border border-primary/25 bg-ok-soft/50 p-4 text-[15px] leading-relaxed">
            <strong className="block text-primary-strong">目的</strong>
            {GOAL}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
            {PLOT_TEXT.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="flow">
          <h2 id="flow" className="text-lg font-bold">判定の流れ</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed">
            {[
              "農林水産省の登録情報から、有効成分・適用作物・使用量を取得",
              "有効成分ごとに、下の4項目の値を公的機関・専門データベースで調査",
              "しきい値に当てはめて、各項目のリスクを「低・中・高・不明」で評価",
              "判定区分のルールを上から順に当てはめて、使用OK／条件付きOK／使用NG／判定不能を決定",
            ].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{t}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="axes">
          <h2 id="axes" className="text-lg font-bold">評価する4項目</h2>
          <p className="mt-1 text-sm text-muted">有効成分が複数あるときは、項目ごとに最もリスクの高い成分で評価します。</p>
          <div className="mt-3 space-y-3">
            {AXES.map((a) => (
              <article key={a.key} className="rounded-2xl border border-line bg-white p-4">
                <h3 className="font-bold">{a.name}</h3>
                <p className="text-sm text-ink">{a.question}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">指標: {a.metric}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {(
                    [
                      ["低", a.low],
                      ["中", a.mid],
                      ["高", a.high],
                    ] as const
                  ).map(([lv, t]) => (
                    <div key={lv} className="flex items-start gap-2">
                      <dt className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[lv]}`}>リスク{lv}</dt>
                      <dd className="leading-relaxed">{t}</dd>
                    </div>
                  ))}
                </dl>
                {a.note && <p className="mt-2 text-xs text-muted">※ {a.note}</p>}
              </article>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            しきい値は、PPDB（農薬特性データベース）や欧州の評価で使われる区分を参考に、本サイトが定めたものです。
          </p>
        </section>

        <section aria-labelledby="rules">
          <h2 id="rules" className="text-lg font-bold">判定区分の決め方</h2>
          <p className="mt-1 text-sm text-muted">上から順に当てはめ、最初に該当した区分になります。</p>
          <ol className="mt-3 space-y-3">
            {VERDICT_RULES.map((r) => (
              <li key={r.verdict} className="rounded-2xl border border-line bg-white p-4">
                <VerdictChip verdict={r.verdict} />
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {r.when.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="sources">
          <h2 id="sources" className="text-lg font-bold">情報源（優先順）</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
            {SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
            {SOURCE_RULES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <p className="border-t border-line pt-6 text-xs leading-relaxed text-muted">
          判定はAIが調査・要約した参考情報です。使用前に必ず製品ラベルを確認し、農薬取締法（適用作物以外への使用禁止など）に従ってください。
        </p>
      </main>
    </div>
  );
}
