import { publicCalendar } from "@/modules/events/calendar";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await publicCalendar(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "The event calendar is temporarily unavailable." },
      { status: 503 },
    );
  }
}
