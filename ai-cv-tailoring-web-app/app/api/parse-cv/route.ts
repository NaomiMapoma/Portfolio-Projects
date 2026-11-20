import { CvParseError, MAX_CV_FILE_BYTES, cleanCvText, parseCvFileWithStyle } from "@/lib/cv-text";
import { NO_STORE, readJson, tooLarge } from "@/lib/http";
import { MAX_UPLOAD_BODY_BYTES } from "@/lib/limits";

// Accepts a PDF or DOCX upload (multipart "file") or pasted text (JSON {text}).
// Processed in memory only. Request and response bodies are never logged.

const headers = NO_STORE;

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers });
}

export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";

    if (type.includes("application/json")) {
      const raw = await readJson(request);
      if (!raw.ok) return raw.response;
      const body = (raw.value ?? {}) as { text?: unknown };
      if (typeof body.text !== "string" || !body.text.trim()) {
        return fail("There is no text to tidy.", 400);
      }
      return Response.json({ text: cleanCvText(body.text) }, { headers });
    }

    if (type.includes("multipart/form-data")) {
      if (tooLarge(request, MAX_UPLOAD_BODY_BYTES)) return fail("That file is over 5MB. Please use a smaller file or paste the text.", 413);
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail("No file was uploaded.", 400);
      if (file.size > MAX_CV_FILE_BYTES) {
        return fail("That file is over 5MB. Please use a smaller file or paste the text.", 413);
      }
      const { text, style } = await parseCvFileWithStyle(Buffer.from(await file.arrayBuffer()), file.name);
      return Response.json({ text, style }, { headers });
    }

    return fail("Send a PDF or Word file, or pasted text.", 415);
  } catch (err) {
    if (err instanceof CvParseError) return fail(err.message, err.status);
    return fail("Something went wrong reading that. Please paste the text instead.", 500);
  }
}
