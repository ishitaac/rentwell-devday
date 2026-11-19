import { jsonResponse } from "../server/http.js";

export function GET(): Response {
  return jsonResponse(200, {
    ok: true,
    service: "fine-print",
    hasModelKey: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
