import type { PoolClient } from "pg";
export type DrawFieldEntry = {
  id: string;
  name: string;
  version: number;
  admitted: boolean;
};
/** Trusted field projection shared by draw workspace/preview/publication.
 * Accepted008 distinguishes organizer records from pending submissions. Future
 * accepted admission work can enrich this one adapter; graph writers must not
 * hardcode submission-origin filters in their own queries. */
export async function readDrawFieldEntries(
  c: Pick<PoolClient, "query">,
  divisionId: string,
  selectedIds?: string[],
  lock = false,
): Promise<DrawFieldEntry[]> {
  const rows = (
    await c.query<{
      id: string;
      name: string;
      version: number;
      entryAdmission: string;
    }>(
      'SELECT e.id,e.display_name AS name,e.version,e.entry_admission AS "entryAdmission" FROM event_entry e WHERE e.division_id=$1 AND ($2::text[] IS NULL OR e.id=ANY($2::text[])) ORDER BY e.id' +
        (lock ? " FOR SHARE OF e" : ""),
      [divisionId, selectedIds ?? null],
    )
  ).rows;
  return rows.map(({ entryAdmission, ...entry }) => ({
    ...entry,
    admitted: entryAdmission === "organizer_recorded",
  }));
}
