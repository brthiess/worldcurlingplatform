import { entryHttp } from "@/modules/entries/http";
import {
  assessmentWorkspace,
  queueEventAssessment,
} from "@/modules/rankings/assessments";
export const GET = (r: Request) =>
  entryHttp(r, false, (userId) => {
    const q = new URL(r.url).searchParams;
    return assessmentWorkspace(
      userId,
      q.get("division") ?? undefined,
      q.get("rules") ?? undefined,
      q.get("assessment") ?? undefined,
    );
  });
export const POST = (r: Request) =>
  entryHttp(r, true, async (userId) =>
    queueEventAssessment(userId, await r.json()),
  );
