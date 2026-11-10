import { entryHttp } from "@/modules/entries/http";
import {
  publicationWorkspace,
  savePublication,
} from "@/modules/rankings/publications";
export const GET = (r: Request) =>
  entryHttp(r, false, (userId) =>
    publicationWorkspace(
      userId,
      Object.fromEntries(new URL(r.url).searchParams),
    ),
  );
export const POST = (r: Request) =>
  entryHttp(r, true, async (userId) => savePublication(userId, await r.json()));
