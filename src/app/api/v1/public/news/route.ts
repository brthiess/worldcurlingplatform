import { pool } from "@/db";
import { publicNews } from "@/modules/news/service";
export async function GET() {
  try {
    return Response.json(await publicNews(pool), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "News is temporarily unavailable. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
