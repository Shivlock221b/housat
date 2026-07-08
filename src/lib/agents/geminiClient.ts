export type GeminiMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "video_url"; video_url: { url: string } }
      >;
};

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_INLINE_MEDIA_BYTES = 7_000_000;

export function hasGeminiPropertyModel() {
  return Boolean(getGeminiApiKey());
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

function modelName() {
  return process.env.GEMINI_PROPERTY_MODEL || process.env.GOOGLE_GEMINI_PROPERTY_MODEL || DEFAULT_MODEL;
}

function endpoint(apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelName()}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function fetchInlineData(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Media fetch failed with ${response.status}`);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_INLINE_MEDIA_BYTES) {
      throw new Error("Media file is too large for inline Gemini analysis.");
    }
    return {
      inlineData: {
        mimeType: contentType.split(";")[0],
        data: Buffer.from(arrayBuffer).toString("base64")
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function messageContentToParts(content: GeminiMessage["content"]) {
  if (typeof content === "string") return [{ text: content }];

  const parts = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
    } else if (part.type === "image_url") {
      try {
        parts.push(await fetchInlineData(part.image_url.url));
      } catch (error) {
        parts.push({ text: `Image URL could not be fetched for automatic analysis: ${part.image_url.url}` });
        console.error("[Gemini] image fetch skipped", { error: error instanceof Error ? error.message : "unknown" });
      }
    } else if (part.type === "video_url") {
      parts.push({
        text:
          `Video URL supplied for admin/property analysis: ${part.video_url.url}\n` +
          "If video content cannot be accessed directly, mark video analysis as missing and ask admin to review manually."
      });
    }
  }
  return parts;
}

async function toGeminiPayload(messages: GeminiMessage[]) {
  const systemText = messages
    .filter((message) => message.role === "system")
    .map((message) => typeof message.content === "string" ? message.content : "")
    .filter(Boolean)
    .join("\n\n");

  const contents = [];
  for (const message of messages.filter((item) => item.role !== "system")) {
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: await messageContentToParts(message.content)
    });
  }

  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json"
    }
  };
}

function extractGeminiText(data: unknown) {
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("\n").trim();
}

export async function callGeminiPropertyModel({
  messages,
  responseSchemaName,
  temperature = 0
}: {
  messages: GeminiMessage[];
  responseSchemaName?: string;
  temperature?: number;
}): Promise<unknown> {
  const apiKey = getGeminiApiKey();
  const model = modelName();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for property-side Gemini calls.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  console.info("[Gemini] call started", { model, responseSchemaName });

  try {
    const payload = await toGeminiPayload(messages);
    payload.generationConfig.temperature = temperature;

    const response = await fetch(endpoint(apiKey), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error("[Gemini] call failed", { model, responseSchemaName, status: response.status });
      throw new Error("Gemini property model request failed.");
    }

    const data = await response.json();
    const content = extractGeminiText(data);
    if (!content) throw new Error("Gemini property model returned no content.");
    console.info("[Gemini] call succeeded", { model, responseSchemaName });
    return parseJsonObject(content);
  } catch (error) {
    console.error("[Gemini] property model fallback used", {
      model,
      responseSchemaName,
      error: error instanceof Error ? error.message : "unknown"
    });
    throw new Error("Gemini property model failed.");
  } finally {
    clearTimeout(timeout);
  }
}
