# Event applications

WCP-004 adds organizer applications and named World Curling administrator review. In the isolated review scenario, sign in at `/admin`, choose **Event applications**, and use **New edition** or open the 2026 foundation edition and choose **Create next year's edition**. Review the copied dates and details; a new edition and fresh division IDs are saved in the same recurring series. The earlier edition is not modified.

An application requires its organizing organization, recurring series (or a new series name), edition name, real start/end dates, city/country and 1–12 named proposed divisions. Supported disciplines are men's/women's four-player and mixed doubles. Venue and competition setup can remain incomplete. A draft saves these essential details without listing the event publicly. **Submit for review** submits the saved version. Unsaved edits must be saved before submission/review.

The seed grants `organizer@demo.invalid` membership in Prairie Curling Club, attaches Prairie Open to that organization and names `administrator@demo.invalid` as its responsible World Curling administrator. Organization membership permits creating editions; the creator receives event-scoped organizer authority atomically. Existing event grants permit ordinary edits. Organization/reviewer provisioning is configuration data, not a public self-grant flow. The administrator's review queue can filter awaiting applications. Only the named responsible administrator with a current global administrator grant may approve or return an application. Rejection needs a reason; organizers may edit and resubmit. Any global administrator may make an ordinary correction, and event organizers may edit their assigned edition, preserving approval and change history.

**Approval admits the edition to the public calendar.** It does not open team registration or determine division ranking eligibility. Those remain separately stored, initially `closed` and `unresolved`; the commands to change them belong to later tickets. Delegated/reassigned approval policy is WCP-005. This slice does not introduce generalized amendment reapproval.

The public `/events` calendar filters actual admitted records by search, dates, location and discipline. A multi-division `/events/:id` lists every division; choose one to see its scores. It never silently treats the first division as the entire edition. The foundation seed retains its fictional label; newly created editions are labelled newly operated records. No current-game or complete competition setup is inferred from calendar admission.

## API

All private reads require a real session. Writes also require the configured same-origin `Origin` header. Authentication/authorization use persisted grants inside commands; body-supplied roles or publication/ranking/registration flags confer no authority.

| Endpoint | Behavior |
|---|---|
| `GET /api/v1/applications` | Current accessible organizations, series and edition summaries; administrator review queue or assigned organizer editions. |
| `POST /api/v1/applications` | `{id, requestId, action:"create", application}` creates a new draft. `application` contains `organizationId`, `seriesId`, optional `newSeriesName`, `name`, `startsOn`, `endsOn`, `city`, `country`, `venue`, `timezone`, and `divisions:[{id,name,discipline}]`. Use new UUIDs for edition, new series and divisions. |
| `GET /api/v1/applications/:id` | Authorized edition details, version, review responsibility, distinct state fields, immutable snapshots and actor/time/reason/audit attribution. |
| `POST /api/v1/applications/:id` | `{requestId,version,action}` where action is `submit`, `approve`, `reject` or `edit`. `reject` needs `reason`; `edit` needs the complete `application` fields. Organization and series cannot change in place. |
| `GET /api/v1/public/calendar` | Only admitted edition/series/location/date/division states; no application history, reviewer identity, credentials or audit data. |
| `GET /api/v1/public/events/:id?division=:divisionId` | Explicit score context plus all public divisions. Multiple divisions without a choice return edition overview with no implicitly selected score division. Unknown or unrelated division IDs return 404. |

Preserve the same request ID/body on an uncertain retry. Identical retries do not duplicate writes/history; reusing an ID for different contents returns 409. Every edit/review includes the version the user reviewed; concurrent/stale saves return 409 and the UI can reload the current version. Invalid fields return 400 with field messages; unrelated actors return 403; unauthenticated requests return 401. A failed storage/audit operation returns 503 with the entire change rolled back. The browser preserves an uncertain command for **Retry last save**. Divisions with entries or scheduled games cannot be removed or switch discipline through application editing.

Application state, created scope, divisions, audit and the immutable version snapshot commit together. PostgreSQL rejects updates/deletes to application history. Verification commands, deliberate storage-failure tests, screenshots and limits are in `docs/verification/WCP-004.md`.
