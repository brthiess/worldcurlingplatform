import { lookup } from "node:dns/promises";
import https from "node:https";
import http from "node:http";
import { articleUrl, isPublicAddress, NewsError } from "../../domain/news";
function fixture(url: URL) {
  const configured = process.env.NEWS_FIXTURE_ORIGIN;
  if (!configured || !process.env.BETTER_AUTH_URL) return false;
  const origin = new URL(configured),
    app = new URL(process.env.BETTER_AUTH_URL);
  return (
    origin.protocol === "http:" &&
    origin.hostname === "127.0.0.1" &&
    app.hostname === "127.0.0.1" &&
    url.origin === origin.origin
  );
}
export function feedUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048)
    throw new NewsError("Invalid feed URL.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NewsError("Invalid feed URL.");
  }
  if (url.username || url.password || url.hash)
    throw new NewsError("Feed URL must not contain credentials or fragments.");
  if (fixture(url)) return url.href;
  return articleUrl(value);
}
export async function fetchFeed(value: string) {
  const url = new URL(feedUrl(value)),
    local = fixture(url);
  const addresses = local
    ? [{ address: "127.0.0.1", family: 4 }]
    : await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((a) => !local && !isPublicAddress(a.address))
  )
    throw new NewsError("Feed destination is not public.");
  const address = addresses[0];
  return new Promise<string>((resolve, reject) => {
    const deadline = setTimeout(
      () => request.destroy(new NewsError("Feed request timed out.")),
      10000,
    );
    const request = (local ? http : https).get(
      url,
      {
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
          "User-Agent": "WorldCurlingPlatform/1.0 linked-news",
        },
        lookup: ((_host: any, options: any, callback: any) =>
          options.all
            ? callback(null, [address])
            : callback(null, address.address, address.family)) as any,
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new NewsError(`Feed returned HTTP ${response.statusCode}.`));
          return;
        }
        const parts: Buffer[] = [];
        let size = 0;
        response.on("data", (part: Buffer) => {
          size += part.length;
          if (size > 1024 * 1024) {
            request.destroy(new NewsError("Feed exceeds 1 MiB."));
            return;
          }
          parts.push(part);
        });
        response.on("end", () =>
          resolve(Buffer.concat(parts).toString("utf8")),
        );
        response.on("error", reject);
      },
    );
    request.setTimeout(10000, () =>
      request.destroy(new NewsError("Feed request timed out.")),
    );
    request.on("error", reject);
    request.on("close", () => clearTimeout(deadline));
  });
}
