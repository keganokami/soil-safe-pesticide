"use client";

import { useState } from "react";
import type { VerdictFile } from "@/lib/data";
import type { Verdict } from "@/lib/verdict";
import { safeHref } from "@/lib/validate";
import { ChevronDown, ExternalLink, ShieldAlert } from "./icons";
import { LEVEL_STYLE, VERDICT_STYLE } from "./verdict-style";

/** keyCautions が無い古いデータ向けに、既存項目から最重要の注意点を組み立てる */
function cautionsOf(v: Verdict): string[] {
  if (v.keyCautions?.length) return v.keyCautions;
  if (v.verdict === "不可" || v.verdict === "判定不能") return v.reasons.slice(0, 3);
  return [...v.usage.soilProtectionTips.slice(0, 2), ...v.usage.spillPrevention.slice(0, 2)];
}

export function Result({ data }: { data: VerdictFile }) {
  const v = data.verdict;
  const s = VERDICT_STYLE[v.verdict];
  const ok = v.verdict === "許可" || v.verdict === "条件付き許可";
  const cautions = cautionsOf(v);
  const quick = ok
    ? ([
        ["区画あたりの量", v.usage.amountForPlot],
        ["希釈", v.usage.dilution],
        ["使用回数", v.usage.maxApplications],
        ["使用時期", v.usage.timing],
      ] as const).filter(([, t]) => t)
    : [];

  return (
    <article className="space-y-4">
      {/* ── ファーストビュー: 判定 ── */}
      <section className={`rounded-2xl px-5 py-5 ${s.hero}`} aria-labelledby="verdict-title">
        <div className="flex items-start gap-3">
          <s.Icon className="mt-0.5 h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm opacity-90">{v.product.name}</p>
            <h2 id="verdict-title" className="text-2xl leading-tight font-bold">
              {s.label}
            </h2>
          </div>
        </div>
        <Summary text={v.summary} />
      </section>

      {/* ── ファーストビュー: 必ず守ること ── */}
      {cautions.length > 0 && (
        <section
          className="rounded-2xl border-2 border-caution bg-caution-soft px-5 py-4"
          aria-labelledby="cautions-title"
        >
          <h3 id="cautions-title" className="flex items-center gap-2 text-lg font-bold text-caution-strong">
            <ShieldAlert className="h-5 w-5" />
            {ok ? "使う前に必ず守ること" : "ここがポイント"}
          </h3>
          <ol className="mt-3 space-y-2.5">
            {cautions.map((c, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-snug text-stone-900">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-caution-strong text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-caution-strong">
            製品ラベルの用法・用量を守り、ラベルに書かれていない作物には使わないでください。
          </p>
        </section>
      )}

      {/* ── 使い方の要点 ── */}
      {quick.length > 0 && (
        <section aria-label="使い方の要点" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {quick.map(([k, t]) => (
            <div key={k} className="rounded-xl border border-line bg-white px-4 py-3">
              <p className="text-xs font-bold text-primary">{k}</p>
              <p className="mt-1 line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap">{t}</p>
            </div>
          ))}
        </section>
      )}

      {/* ── 詳細（折りたたみ） ── */}
      <div className="space-y-2">
        {ok && (
          <Section title="この区画（150×150cm）での使い方" defaultOpen>
            <dl className="space-y-3 text-sm">
              {(
                [
                  ["対象作物・病害虫", v.usage.targetCropsAndPests],
                  ["希釈倍数", v.usage.dilution],
                  ["区画あたりの量", v.usage.amountForPlot],
                  ["使用時期", v.usage.timing],
                  ["使用回数", v.usage.maxApplications],
                  ["使用方法", v.usage.method],
                ] as const
              )
                .filter(([, t]) => t)
                .map(([k, t]) => (
                  <div key={k}>
                    <dt className="font-bold text-muted">{k}</dt>
                    <dd className="mt-0.5 leading-relaxed whitespace-pre-wrap">{t}</dd>
                  </div>
                ))}
            </dl>
            {v.usage.soilProtectionTips.length > 0 && (
              <SubList title="土壌を守るためのポイント" items={v.usage.soilProtectionTips} />
            )}
            {v.usage.spillPrevention.length > 0 && (
              <SubList title="区画外へのこぼれ・流出対策" items={v.usage.spillPrevention} />
            )}
          </Section>
        )}

        <Section title="土壌への影響評価" defaultOpen={!ok}>
          <ul className="space-y-4">
            {(
              [
                ["土壌残留性", v.soilAssessment.persistence],
                ["土壌移動性", v.soilAssessment.mobility],
                ["土壌生物への影響", v.soilAssessment.soilOrganisms],
                ["こぼれた時の影響", v.soilAssessment.aquaticRiskOnSpill],
              ] as const
            ).map(([label, a]) => (
              <li key={label}>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[a.level]}`}>
                    リスク{a.level}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-stone-700">{a.detail}</p>
              </li>
            ))}
          </ul>
        </Section>

        {v.reasons.length > 0 && (
          <Section title={v.verdict === "不可" ? "使用できない理由" : "判定理由"} defaultOpen={!ok}>
            <Bullets items={v.reasons} />
          </Section>
        )}

        {v.alternatives.length > 0 && (
          <Section title="土にやさしい代替案" defaultOpen={!ok}>
            <Bullets items={v.alternatives} />
          </Section>
        )}

        <Section title="製品情報と出典">
          <dl className="space-y-1.5 text-sm">
            <Row k="登録番号" v={v.product.registrationNumber || "なし（農薬登録なし）"} />
            <Row k="種類" v={v.product.pesticideType} />
            <Row k="有効成分" v={v.product.activeIngredients.join("、")} />
            {v.product.registrant && <Row k="登録者" v={v.product.registrant} />}
            <Row k="判定日" v={`${new Date(data.generatedAt).toLocaleDateString("ja-JP")}（${data.model}）`} />
          </dl>
          <ul className="mt-4 space-y-1">
            {data.detail && (
              <li>
                <SourceLink href={data.detail.url} title="農林水産省 農薬登録情報（適用表）" />
              </li>
            )}
            {v.sources
              .filter((src) => src.url !== data.detail?.url)
              .map((src) => (
                <li key={src.url}>
                  <SourceLink href={src.url} title={src.title || src.url} />
                </li>
              ))}
          </ul>
        </Section>
      </div>
    </article>
  );
}

/** 要約はファーストビューを圧迫しないよう3行に省略し、タップで全文 */
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <p className={`text-[15px] leading-relaxed opacity-95 ${open ? "" : "line-clamp-3"}`}>{text}</p>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-1 min-h-11 cursor-pointer text-sm font-bold underline underline-offset-2"
      >
        {open ? "閉じる" : "判定の要旨を全部読む"}
      </button>
    </div>
  );
}

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-line bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  );
}

function SubList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5">
      <h4 className="mb-1.5 text-sm font-bold text-primary">{title}</h4>
      <Bullets items={items} />
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
}

function SourceLink({ href, title }: { href: string; title: string }) {
  const safe = safeHref(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex min-h-11 items-start gap-1.5 py-2 text-sm break-all text-primary underline underline-offset-2"
    >
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
      {title}
    </a>
  );
}
