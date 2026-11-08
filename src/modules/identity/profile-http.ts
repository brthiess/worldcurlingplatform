import { actor } from "./access";
import { ProfileError } from "@/domain/profiles";
export async function profileCommand(
  request: Request,
  run: (id: string, value: unknown) => Promise<unknown>,
  status = 200,
) {
  try {
    if (
      request.headers.get("origin") !==
      new URL(process.env.BETTER_AUTH_URL!).origin
    )
      throw new ProfileError("Untrusted request origin.", 403);
    const current = await actor(request.headers);
    if (!current) throw new ProfileError("Sign in required.", 401);
    if (Number(request.headers.get("content-length") ?? 0) > 8192)
      throw new ProfileError("Request too large.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new ProfileError("Invalid JSON.");
    let bytes = 0,
      raw = "";
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        throw new ProfileError("Request too large.", 413);
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new ProfileError("Invalid JSON.");
    }
    return Response.json(await run(current.id, value), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ProfileError
            ? error.message
            : "Could not save. Refresh the current status before retrying.",
      },
      {
        status: error instanceof ProfileError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
