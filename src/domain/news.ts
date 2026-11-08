import { XMLParser, XMLValidator } from "fast-xml-parser";
import { isIP } from "node:net";
export class NewsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function safeText(value: unknown, limit = 280): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|[0-9]+);/gi,
      (e) => {
        const named: Record<string, string> = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&nbsp;": " ",
        };
        if (named[e]) return named[e];
        const n =
          e[2]?.toLowerCase() === "x"
            ? parseInt(e.slice(3, -1), 16)
            : parseInt(e.slice(2, -1), 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
      },
    )
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}
export function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(address) === 6) {
    const words = address.split(":");
    const first = parseInt(words[0], 16),
      second = parseInt(words[1] || "0", 16);
    return (
      first >= 0x2000 &&
      first <= 0x2fff &&
      first !== 0x2002 &&
      !(first === 0x2001 && (second < 0x200 || second === 0xdb8))
    );
  }
  return false;
}
export function articleUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048)
    throw new NewsError("Invalid article URL.");
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new NewsError("Invalid article URL.");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    u.hostname === "localhost" ||
    u.hostname.endsWith(".local") ||
    (isIP(u.hostname.replace(/^\[|\]$/g, "")) &&
      !isPublicAddress(u.hostname.replace(/^\[|\]$/g, "")))
  )
    throw new NewsError("Use a public HTTPS URL without credentials.");
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.href;
}
export type NewsItem = {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  excerpt: string;
};
const list = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
export function normalizeFeed(
  xml: string,
  publisher: string,
  now = new Date(),
): NewsItem[] {
  if (
    Buffer.byteLength(xml) > 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new NewsError("Feed is not valid bounded RSS or Atom.");
  const doc = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: true,
  }).parse(xml);
  const raw = doc.rss?.channel?.item ?? doc.feed?.entry;
  if (!doc.rss?.channel && !doc.feed)
    throw new NewsError("Feed must be RSS or Atom.");
  const result: NewsItem[] = [];
  const seen = new Set<string>();
  for (const item of list(raw).slice(0, 200)) {
    try {
      const link =
        typeof item.link === "string"
          ? item.link
          : list(item.link).find(
              (l: any) => !l["@_rel"] || l["@_rel"] === "alternate",
            )?.["@_href"];
      const url = articleUrl(link),
        title = safeText(item.title?.["#text"] ?? item.title, 180),
        date = String(item.pubDate ?? item.published ?? item.updated ?? "");
      if (
        !title ||
        !/(?:\d{4}-\d\d-\d\d|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/.test(date)
      )
        continue;
      const publishedAt = new Date(date);
      const iso = date.match(/^(\d{4})-(\d\d)-(\d\d)/);
      if (
        iso &&
        new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
          .toISOString()
          .slice(0, 10) !== iso[0]
      )
        continue;
      if (
        !Number.isFinite(+publishedAt) ||
        +publishedAt > +now + 86400000 ||
        publishedAt.getUTCFullYear() < 1990 ||
        seen.has(url)
      )
        continue;
      seen.add(url);
      result.push({
        title,
        publisher: safeText(publisher, 100),
        url,
        publishedAt: publishedAt.toISOString(),
        excerpt: safeText(
          item.description ?? item.summary?.["#text"] ?? item.summary,
          280,
        ),
      });
    } catch {
      /* Invalid feed entries never become public news. */
    }
  }
  return result;
}
