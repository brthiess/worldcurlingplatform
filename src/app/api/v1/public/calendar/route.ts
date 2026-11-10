import { publicCalendar } from "@/modules/events/calendar";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(
      await publicCalendar(
        Object.fromEntries(new URL(request.url).searchParams),
      ),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { error: "The event calendar is temporarily unavailable." },
      { status: 503 },
    );
  }
}
