import type { PoolClient } from "pg";
import { canEnterDraw, type AdmissionState } from "@/domain/registration";
export type DrawFieldEntry = {
  id: string;
  name: string;
  version: number;
  teamId: string | null;
  admitted: boolean;
};
/** Trusted field projection shared by draw workspace/preview/publication.
 * Configured registration requires accepted admission, independently of origin.
 * Unconfigured legacy organizer records retain their sporting behavior. Graph writers must not
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
      teamId: string | null;
      entryAdmission: string;
      admissionState: AdmissionState;
      registrationConfigured: boolean;
    }>(
      'SELECT e.id,e.display_name AS name,e.version,e.team_id AS "teamId",e.entry_admission AS "entryAdmission",e.admission_state AS "admissionState",(r.division_id IS NOT NULL) AS "registrationConfigured" FROM event_entry e LEFT JOIN division_registration r ON r.division_id=e.division_id WHERE e.division_id=$1 AND ($2::text[] IS NULL OR e.id=ANY($2::text[])) ORDER BY e.id' +
        (lock ? " FOR SHARE OF e" : ""),
      [divisionId, selectedIds ?? null],
    )
  ).rows;
  return rows.map(
    ({ entryAdmission, admissionState, registrationConfigured, ...entry }) => ({
      ...entry,
      admitted: canEnterDraw({
        entryAdmission,
        admissionState,
        registrationConfigured,
      }),
    }),
  );
}
