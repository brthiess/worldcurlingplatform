import { publicDraw } from "@/modules/draws/draws";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const data = await publicDraw((await params).id);
    return Response.json(data ?? { error: "Published draw not found." }, {
      status: data ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("Public draw failed", e);
    return Response.json(
      { error: "Draw could not be loaded." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
