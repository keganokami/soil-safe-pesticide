"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { IndexEntry, VerdictFile } from "@/lib/data";
import { Result } from "@/components/Result";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isIndexEntry, isSafeId, isVerdictFile, safeHref } from "@/lib/validate";
import { VerdictChip } from "@/components/verdict-style";
import { ChevronLeft, ChevronRight, ExternalLink, Search, Send, Sprout } from "@/components/icons";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "";
// Googleフォーム（GitHubアカウント不要）。未設定なら GitHub Issue にフォールバック
const FORM_URL = process.env.NEXT_PUBLIC_REQUEST_FORM_URL ?? "";
const FORM_NAME_ENTRY = process.env.NEXT_PUBLIC_REQUEST_FORM_NAME_ENTRY ?? ""; // 例: entry.123456789
// 要望・感想アンケート（未設定ならリンクを出さない）
const FEEDBACK_URL = safeHref(process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL ?? "");

function requestUrl(query: string): string | null {
  if (FORM_URL) {
    if (!FORM_NAME_ENTRY) return FORM_URL;
    const u = new URL(FORM_URL);
    u.searchParams.set("usp", "pp_url");
    u.searchParams.set(FORM_NAME_ENTRY, query);
    return u.toString();
  }
  if (REPO_URL) return `${REPO_URL}/issues/new?template=request.yml&title=${encodeURIComponent(`判定リクエスト: ${query}`)}`;
  return null;
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
// ひらがな→カタカナ（「ろはぴ」でも「ロハピ」に当たるように）
const kata = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

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

const idFromUrl = () => {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("id");
  return isSafeId(id) ? id : null; // 不正な id は無視して一覧を表示
};

export default function Home() {
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<VerdictFile | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 一覧の読み込み
  useEffect(() => {
    setError(null);
    fetchJson<unknown>(`${BASE}/data/index.json`)
      .then((d) => setIndex(Array.isArray(d) ? d.filter(isIndexEntry) : []))
      .catch((e) => setError(`判定データを読み込めませんでした（${e.message}）`));
  }, [reloadKey]);

  // URL(?id=) と画面を同期（ブラウザの戻る/直リンク対応）
  useEffect(() => {
    const sync = () => setSelectedId(idFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // 詳細の読み込み
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let alive = true;
    setLoadingDetail(true);
    setError(null);
    fetchJson<unknown>(`${BASE}/data/verdicts/${encodeURIComponent(selectedId)}.json`)
      .then((d) => {
        if (!alive) return;
        if (!isVerdictFile(d) || d.id !== selectedId) throw new Error("データ形式が不正です");
        setSelected(d);
      })
      .catch((e) => alive && setError(`判定結果を読み込めませんでした（${e.message}）`))
      .finally(() => alive && setLoadingDetail(false));
    window.scrollTo({ top: 0 });
    return () => {
      alive = false;
    };
  }, [selectedId, reloadKey]);

  const navigate = useCallback((id: string | null) => {
    const url = id ? `?id=${encodeURIComponent(id)}` : window.location.pathname;
    window.history.pushState(null, "", url);
    setSelectedId(id);
  }, []);

  const results = useMemo(() => {
    if (!index) return [];
    const q = kata(norm(query));
    if (!q) return index;
    return index.filter((e) =>
      [e.name, e.query, e.pesticideType, e.registrationNumber].some((f) => kata(norm(f)).includes(q)),
    );
  }, [index, query]);

  const errorBox = error && (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-danger-strong">
      <p>{error}</p>
      <button
        onClick={() => setReloadKey((k) => k + 1)}
        className="mt-3 min-h-11 cursor-pointer rounded-xl bg-danger px-4 text-sm font-bold text-white"
      >
        再読み込み
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      {/* 上部バー（固定） */}
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          {selectedId ? (
            <button
              onClick={() => navigate(null)}
              className="-ml-2 flex min-h-11 cursor-pointer items-center gap-1 rounded-xl px-2 font-bold text-primary"
            >
              <ChevronLeft className="h-5 w-5" />
              一覧へ
            </button>
          ) : (
            <p className="flex items-center gap-2 font-bold text-primary-strong">
              <Sprout className="h-6 w-6 text-primary" />
              土にやさしい農薬チェッカー
            </p>
          )}
          <Link
            href="/criteria/"
            className="ml-auto flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-primary underline-offset-2 hover:underline"
          >
            判定基準
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {selectedId ? (
          <>
            {errorBox}
            {loadingDetail && !selected && <Skeleton />}
            {selected && (
              <ErrorBoundary
                key={selected.id}
                fallback={<p className="rounded-2xl border border-line bg-white p-5">この判定結果は表示できませんでした。</p>}
              >
                <Result data={selected} />
              </ErrorBoundary>
            )}
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-muted">
              農林水産省の農薬登録情報と専門機関の環境データをもとに、
              <strong className="text-ink">150×150cm・土の高さ約60cm</strong>
              の区画で、土の生き物を守りながら使えるかを判定しています。
            </p>

            {/* まだ判定されていない商品 → リクエスト（常に見える位置に） */}
            <RequestCard query={query.trim()} />

            <label htmlFor="q" className="mt-6 mb-1.5 block text-sm font-bold">
              判定済みの商品から探す{index && <span className="ml-1 font-normal text-muted">（{index.length}件）</span>}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                id="q"
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="商品名で絞り込み（例：ロハピ）"
                autoComplete="off"
                maxLength={60}
                className="h-13 w-full rounded-2xl border border-line bg-white pr-4 pl-11 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <div className="mt-4">{errorBox}</div>

            {!index && !error && <Skeleton list />}

            {index && results.length > 0 && (
              <>
                {query && <p className="mb-2 text-xs text-muted">{results.length} 件</p>}
                <ul className="space-y-2">
                  {results.map((e) => (
                    <li key={e.id}>
                      <a
                        href={`?id=${encodeURIComponent(e.id)}`}
                        onClick={(ev) => {
                          ev.preventDefault();
                          navigate(e.id);
                        }}
                        className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 transition-colors duration-200 hover:border-primary/40 active:bg-ok-soft/40"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{e.name}</span>
                          <span className="block truncate text-xs text-muted">{e.pesticideType}</span>
                        </span>
                        <VerdictChip verdict={e.verdict} />
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {index && results.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                「{query}」はまだ判定されていません。上のボタンからリクエストできます。
              </p>
            )}
          </>
        )}

        <footer className="mt-12 border-t border-line py-6 text-xs leading-relaxed text-muted">
          <p>
            登録情報の出典:{" "}
            <a className="underline" href="https://pesticide.maff.go.jp/" target="_blank" rel="noreferrer">
              農林水産省 農薬登録情報提供システム
            </a>
            。環境データはAIが公的機関・メーカー・専門データベースを調査して要約したものです。
          </p>
          <p className="mt-2">
            本判定は参考情報です。判定のしかたは
            <Link href="/criteria/" className="underline">
              判定基準
            </Link>
            をご覧ください。使用前に必ず製品ラベルを確認し、農薬取締法に従ってください。
          </p>
          {FEEDBACK_URL && (
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-bold text-primary"
            >
              ご意見・ご要望をお聞かせください
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </footer>
      </main>
    </div>
  );
}

/** 未判定の商品のリクエスト導線。検索欄に入力した語はフォームに引き継ぐ */
function RequestCard({ query }: { query: string }) {
  const href = requestUrl(query);
  if (!href) return null;
  return (
    <section aria-labelledby="req-title" className="mt-5 rounded-2xl border border-primary/25 bg-ok-soft/50 p-4">
      <h2 id="req-title" className="font-bold text-primary-strong">
        まだ判定されていない商品は？
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink">
        商品名を送ると自動で判定し、数分〜十数分でこのサイトに追加されます（登録不要・1分）。
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-white transition-colors duration-200 hover:bg-primary-strong"
      >
        <Send className="h-5 w-5 shrink-0" />
        <span className="line-clamp-2 py-2 text-center break-all">{query ? `「${query}」をリクエスト` : "判定をリクエストする"}</span>
      </a>
    </section>
  );
}

function Skeleton({ list }: { list?: boolean }) {
  return (
    <div aria-busy="true" aria-label="読み込み中" className="space-y-3">
      <p className="text-sm text-muted">読み込み中…</p>
      {(list ? [0, 1, 2] : [0, 1]).map((i) => (
        <div key={i} className={`animate-pulse rounded-2xl bg-line/60 ${list ? "h-16" : "h-36"}`} />
      ))}
    </div>
  );
}
