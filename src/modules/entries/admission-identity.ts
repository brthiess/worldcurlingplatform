import type { PoolClient } from "pg";
import { EntryError } from "@/domain/entries";

/** Caller owns edition EXCLUSIVE, or edition SHARE plus the division admission advisory lock.
 * Never lock peer entries after holding a division row lock. Pending evidence remains independent. */
export async function assertAdmissionTeamAvailable(
  c: Pick<PoolClient, "query">,
  divisionId: string,
  teamId: string | null,
  entryId: string,
  now: Date,
  revealContext: boolean,
) {
  if (!teamId) return;
  const found = (
    await c.query(
      "SELECT id,display_name FROM event_entry WHERE division_id=$1 AND team_id=$2 AND id<>$3 AND (admission_state='accepted' OR (admission_state='held' AND reservation_deadline>$4)) ORDER BY id LIMIT 1",
      [divisionId, teamId, entryId, now],
    )
  ).rows[0];
  if (found)
    throw new EntryError(
      `This known team already has an active place in this division.${revealContext ? ` Review ${found.display_name} (${found.id}) before admitting or changing another entry.` : " Ask the organizer to review the existing team entry; pending evidence has been retained."}`,
      409,
    );
}
