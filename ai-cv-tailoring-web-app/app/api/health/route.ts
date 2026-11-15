import { NO_STORE } from "@/lib/http";

// Reports only whether an API key is configured, so the page can say so before
// anyone clicks Analyse. It never returns the key, and never touches CV text.
export function GET() {
  return Response.json({ keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY) }, { headers: NO_STORE });
}
