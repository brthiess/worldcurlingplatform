import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { NewsError, normalizeFeed, safeText } from "../../domain/news";
import { feedUrl, fetchFeed } from "./fetch";
import { newsProducer, newsQueue } from "./queue";
async function transaction<T>(pool: Pool, run: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await run(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function admin(c: Pool | PoolClient, userId: string) {
  if (
    !(
      await c.query(
        "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
        [userId],
      )
    ).rowCount
  )
    throw new NewsError("Global administrator authority required.", 403);
}
function reason(value: unknown) {
  if (
    typeof value !== "string" ||
    value.trim().length < 5 ||
    value.length > 500
  )
    throw new NewsError("Provide a reason between 5 and 500 characters.");
  return safeText(value, 500);
}
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new NewsError("Current version required.", 409);
  return value;
}
async function audit(
  c: PoolClient,
  userId: string,
  action: string,
  id: string,
  why: string,
  details: unknown,
) {
  await c.query(
    "INSERT INTO news_audit(id,actor_id,action,resource_id,reason,details) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), userId, action, id, why, JSON.stringify(details)],
  );
}
export async function manageSource(pool: Pool, userId: string, input: any) {
  return transaction(pool, async (c) => {
    await admin(c, userId);
    const why = reason(input.reason);
    if (typeof input.approved !== "boolean")
      throw new NewsError("Choose an approval state.");
    if (input.id) {
      const result = await c.query(
        `UPDATE news_source SET approved=$1,version=version+1,approved_by=CASE WHEN $1 THEN $2 ELSE approved_by END,approved_at=CASE WHEN $1 THEN now() ELSE approved_at END WHERE id=$3 AND version=$4 RETURNING id,version`,
        [input.approved, userId, input.id, version(input.version)],
      );
      if (!result.rowCount)
        throw new NewsError("Source changed. Refresh before retrying.", 409);
      await audit(
        c,
        userId,
        input.approved ? "source-approved" : "source-suspended",
        input.id,
        why,
        { approved: input.approved, version: result.rows[0].version },
      );
      return result.rows[0];
    }
    const publisher = safeText(input.publisher, 100);
    if (
      !publisher ||
      typeof input.publisher !== "string" ||
      input.publisher.length > 100
    )
      throw new NewsError("Publisher must contain 1 to 100 characters.");
    const url = feedUrl(input.feedUrl),
      id = randomUUID();
    try {
      await c.query(
        "INSERT INTO news_source(id,publisher,feed_url,approved,approved_by,approved_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $4 THEN now() END)",
        [id, publisher, url, input.approved, input.approved ? userId : null],
      );
    } catch (e: any) {
      if (e.code === "23505")
        throw new NewsError("This feed is already configured.", 409);
      throw e;
    }
    await audit(c, userId, "source-created", id, why, {
      publisher,
      feedUrl: url,
      approved: input.approved,
    });
    return { id, version: 1 };
  });
}
export async function moderateItem(pool: Pool, userId: string, input: any) {
  return transaction(pool, async (c) => {
    await admin(c, userId);
    const why = reason(input.reason);
    if (typeof input.hidden !== "boolean")
      throw new NewsError("Choose item visibility.");
    const result = await c.query(
      "UPDATE news_item SET hidden=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING id,version",
      [input.hidden, input.id, version(input.version)],
    );
    if (!result.rowCount)
      throw new NewsError("Item changed. Refresh before retrying.", 409);
    await audit(
      c,
      userId,
      input.hidden ? "item-hidden" : "item-restored",
      input.id,
      why,
      { hidden: input.hidden, version: result.rows[0].version },
    );
    return result.rows[0];
  });
}
export async function enqueueFetch(pool: Pool, userId: string, input: any) {
  const boss = await newsProducer();
  return transaction(pool, async (c) => {
    await admin(c, userId);
    const source = (
      await c.query(
        "SELECT id,approved,version FROM news_source WHERE id=$1 FOR SHARE",
        [input.id],
      )
    ).rows[0];
    if (!source) throw new NewsError("Source not found.", 404);
    if (!source.approved)
      throw new NewsError("Approve the source before fetching.", 409);
    if (source.version !== version(input.version))
      throw new NewsError("Source changed. Refresh first.", 409);
    const id = await boss.send(
      newsQueue,
      { sourceId: source.id },
      {
        db: { executeSql: (text, values) => c.query(text, values) },
        retryLimit: 3,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 60,
        singletonKey: source.id,
        singletonSeconds: 30,
      },
    );
    if (!id)
      throw new NewsError(
        "A fetch is already queued. Refresh status shortly.",
        409,
      );
    await audit(
      c,
      userId,
      "fetch-requested",
      source.id,
      "Staff requested approved feed refresh",
      { jobId: id },
    );
    return { jobId: id };
  });
}
export async function staffNews(pool: Pool, userId: string) {
  await admin(pool, userId);
  const sources = (
    await pool.query(
      `SELECT id,publisher,feed_url AS "feedUrl",approved,version,last_attempt_at AS "lastAttemptAt",last_success_at AS "lastSuccessAt",last_error AS "lastError",(last_success_at IS NULL OR last_success_at<now()-interval '24 hours') AS stale FROM news_source ORDER BY publisher,id`,
    )
  ).rows;
  const items = (
    await pool.query(
      `SELECT id,source_id AS "sourceId",publisher,title,original_url AS url,published_at AS "publishedAt",excerpt,hidden,version FROM news_item ORDER BY published_at DESC,id LIMIT 200`,
    )
  ).rows;
  const attempts = (
    await pool.query(
      `SELECT source_id AS "sourceId",job_id AS "jobId",state,item_count AS "itemCount",error,created_at AS "createdAt" FROM news_fetch_attempt ORDER BY created_at DESC LIMIT 100`,
    )
  ).rows;
  return { sources, items, attempts };
}
export async function publicNews(pool: Pool) {
  const items = (
    await pool.query(
      `SELECT i.id,i.source_id AS "sourceId",i.title,i.publisher,i.published_at AS "publishedAt",i.excerpt,i.original_url AS url FROM news_item i JOIN news_source s ON s.id=i.source_id WHERE s.approved AND NOT i.hidden ORDER BY i.published_at DESC,i.id LIMIT 100`,
    )
  ).rows;
  const sources = (
    await pool.query(
      `SELECT id,publisher,last_success_at AS "lastSuccessAt",(last_error IS NOT NULL) AS failed,(last_success_at IS NULL OR last_success_at<now()-interval '24 hours') AS stale FROM news_source WHERE approved ORDER BY publisher,id`,
    )
  ).rows;
  return { items, sources, refreshedAt: new Date().toISOString() };
}
export async function fetchSource(pool: Pool, sourceId: string, jobId: string) {
  const source = (
    await pool.query(
      "SELECT id,publisher,feed_url,approved,version FROM news_source WHERE id=$1",
      [sourceId],
    )
  ).rows[0];
  if (!source) return;
  if (!source.approved) {
    await pool.query(
      "INSERT INTO news_fetch_attempt(id,source_id,job_id,state) VALUES($1,$2,$3,'skipped')",
      [randomUUID(), sourceId, jobId],
    );
    return;
  }
  await pool.query("UPDATE news_source SET last_attempt_at=now() WHERE id=$1", [
    sourceId,
  ]);
  try {
    const entries = normalizeFeed(
      await fetchFeed(source.feed_url),
      source.publisher,
    );
    await transaction(pool, async (c) => {
      const current = (
        await c.query(
          "SELECT approved,version FROM news_source WHERE id=$1 FOR UPDATE",
          [sourceId],
        )
      ).rows[0];
      if (!current.approved || current.version !== source.version) {
        await c.query(
          "INSERT INTO news_fetch_attempt(id,source_id,job_id,state) VALUES($1,$2,$3,'skipped')",
          [randomUUID(), sourceId, jobId],
        );
        return;
      }
      let count = 0;
      for (const item of entries) {
        const result = await c.query(
          "INSERT INTO news_item(id,source_id,original_url,title,publisher,published_at,excerpt) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(original_url) DO NOTHING",
          [
            randomUUID(),
            sourceId,
            item.url,
            item.title,
            item.publisher,
            item.publishedAt,
            item.excerpt,
          ],
        );
        count += result.rowCount ?? 0;
      }
      await c.query(
        "UPDATE news_source SET last_success_at=now(),last_error=NULL WHERE id=$1",
        [sourceId],
      );
      await c.query(
        "INSERT INTO news_fetch_attempt(id,source_id,job_id,state,item_count) VALUES($1,$2,$3,'succeeded',$4)",
        [randomUUID(), sourceId, jobId, count],
      );
    });
  } catch (e) {
    const message =
      e instanceof NewsError
        ? e.message
        : "Feed could not be fetched. Check destination and try again.";
    await transaction(pool, async (c) => {
      await c.query("UPDATE news_source SET last_error=$1 WHERE id=$2", [
        message,
        sourceId,
      ]);
      await c.query(
        "INSERT INTO news_fetch_attempt(id,source_id,job_id,state,error) VALUES($1,$2,$3,'failed',$4)",
        [randomUUID(), sourceId, jobId, message],
      );
    });
    throw new NewsError(message, 503);
  }
}
