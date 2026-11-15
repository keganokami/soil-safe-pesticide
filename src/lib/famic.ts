import * as cheerio from "cheerio";

/**
 * 農林水産省「農薬登録情報提供システム」(https://pesticide.maff.go.jp/) からの取得。
 * 公開APIは無いため、公開されている検索フォーム・詳細ページをサーバー側で取得して解析する。
 */
export const FAMIC_BASE = "https://pesticide.maff.go.jp";
const UA = "soil-safe-pesticide/0.1 (+https://github.com/)";

export type Candidate = {
  registrationNumber: string;
  type: string; // 農薬の種類
  name: string; // 農薬の名称
  toxicity: string; // 製剤毒性
  url: string;
};

export type PesticideDetail = {
  registrationNumber: string;
  name: string;
  url: string;
  basic: Record<string, string>;
  ingredients: { kind: string; name: string; concentration: string }[];
  applicationTable: Record<string, string>[];
};

export const normalize = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim();

class CookieJar {
  private store = new Map<string, string>();
  absorb(res: Response) {
    const list =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie") ?? ""];
    for (const c of list) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.store.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() {
    return [...this.store].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function get(url: string, jar: CookieJar) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Cookie: jar.header() },
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  jar.absorb(res);
  return res;
}

/** 英数字・記号を全角に（FAMICは「ベニカＸ」のように全角で登録されていることが多い） */
const toFullWidth = (s: string) =>
  s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, "　");

/**
 * 商品名で検索して候補一覧を返す（1ページ目のみ）。
 * FAMICの検索は半角/全角を区別するため、入力そのまま → 半角 → 全角 の順で試す。
 */
export async function searchByName(name: string): Promise<Candidate[]> {
  const variants = [...new Set([name, normalize(name), toFullWidth(normalize(name))])];
  for (const v of variants) {
    const found = await searchOnce(v);
    if (found.length) return found;
  }
  return [];
}

async function searchOnce(name: string): Promise<Candidate[]> {
  const jar = new CookieJar();
  const formRes = await get(`${FAMIC_BASE}/agricultural-chemicals/name-search/`, jar);
  if (!formRes.ok) throw new Error(`FAMIC search form: HTTP ${formRes.status}`);
  const formHtml = await formRes.text();
  const csrf = cheerio.load(formHtml)('input[name="_csrf"]').first().attr("value");
  if (!csrf) throw new Error("FAMIC: CSRFトークンが取得できませんでした");

  const body = new URLSearchParams({
    _csrf: csrf,
    agriculturalChemicalsName: name,
    agriculturalChemicalsType: "",
  });
  const postRes = await fetch(`${FAMIC_BASE}/agricultural-chemicals/name-search`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Cookie: jar.header(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  jar.absorb(postRes);
  const location = postRes.headers.get("location") ?? "/agricultural-chemicals/list";
  const listRes = await get(new URL(location, FAMIC_BASE).toString(), jar);
  if (!listRes.ok) throw new Error(`FAMIC list: HTTP ${listRes.status}`);
  const $ = cheerio.load(await listRes.text());

  const out: Candidate[] = [];
  $("table.search_results tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 4) return;
    const href = $(tds[0]).find("a").attr("href");
    if (!href) return;
    out.push({
      registrationNumber: normalize($(tds[0]).text()),
      type: normalize($(tds[1]).text()),
      name: normalize($(tds[2]).text()),
      toxicity: normalize($(tds[3]).text()),
      url: new URL(href, FAMIC_BASE).toString(),
    });
  });

  // 完全一致を先頭に
  const q = normalize(name);
  return out.sort((a, b) => Number(b.name === q) - Number(a.name === q));
}

/** 登録番号から詳細（基本情報・成分・適用表）を取得 */
export async function getDetail(registrationNumber: string): Promise<PesticideDetail> {
  if (!/^\d{1,6}$/.test(registrationNumber)) throw new Error("登録番号が不正です");
  const url = `${FAMIC_BASE}/agricultural-chemicals/details/${registrationNumber}`;
  const res = await get(url, new CookieJar());
  if (!res.ok) throw new Error(`FAMIC detail: HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());

  const basic: Record<string, string> = {};
  $("table.default_table tr").each((_, tr) => {
    const k = normalize($(tr).find("th").first().text());
    const v = normalize($(tr).find("td").first().text());
    if (k) basic[k] = v;
  });

  const ingredients: PesticideDetail["ingredients"] = [];
  $("table.col2_table tbody tr").each((_, tr) => {
    const kind = normalize($(tr).find("th:not(.sp_only)").first().text());
    const tds = $(tr).find("td");
    if (!kind || tds.length < 2) return;
    ingredients.push({
      kind,
      name: normalize($(tds[0]).text()),
      concentration: normalize($(tds[1]).text()),
    });
  });

  const applicationTable: Record<string, string>[] = [];
  $("table.scloll_table tr").each((_, tr) => {
    const row: Record<string, string> = {};
    $(tr)
      .find("td[data-label]")
      .each((__, td) => {
        row[normalize($(td).attr("data-label") ?? "")] = normalize($(td).text());
      });
    if (Object.keys(row).length) applicationTable.push(row);
  });

  return {
    registrationNumber,
    name: basic["農薬の名称"] ?? normalize($("h1").first().text()),
    url,
    basic,
    ingredients,
    applicationTable,
  };
}
