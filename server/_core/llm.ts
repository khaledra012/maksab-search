import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?:
      | "audio/mpeg"
      | "audio/wav"
      | "application/pdf"
      | "audio/mp4"
      | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

type GeminiResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const contentPartToText = (part: MessageContent): string => {
  if (typeof part === "string") {
    return part;
  }

  if (part.type === "text") {
    return part.text;
  }

  if (part.type === "image_url") {
    return `Image URL: ${part.image_url.url}`;
  }

  if (part.type === "file_url") {
    return `File URL: ${part.file_url.url}`;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessageContentToText = (
  content: MessageContent | MessageContent[]
): string =>
  ensureArray(content)
    .map(contentPartToText)
    .filter(Boolean)
    .join("\n");

const normalizeRoleForGemini = (role: Role): "user" | "model" => {
  if (role === "assistant") {
    return "model";
  }

  return "user";
};

const extractSystemInstruction = (messages: Message[]): string | undefined => {
  const systemText = messages
    .filter(message => message.role === "system")
    .map(message => normalizeMessageContentToText(message.content).trim())
    .filter(Boolean)
    .join("\n\n");

  return systemText || undefined;
};

const buildGeminiContents = (messages: Message[]): GeminiContent[] => {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      continue;
    }

    const text = normalizeMessageContentToText(message.content).trim();
    if (!text) {
      continue;
    }

    const role = normalizeRoleForGemini(message.role);
    const previous = contents[contents.length - 1];

    if (previous && previous.role === role) {
      previous.parts.push({ text });
      continue;
    }

    contents.push({
      role,
      parts: [{ text }],
    });
  }

  if (contents.length === 0) {
    contents.push({
      role: "user",
      parts: [{ text: "Continue." }],
    });
  }

  return contents;
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = (model: string) =>
  `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`;

const resolveModel = () => ENV.geminiModel || "gemini-2.5-flash";

const assertApiKey = () => {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}): GeminiResponseFormat | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const typeMap: Record<string, string> = {
  object: "OBJECT",
  array: "ARRAY",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  null: "NULL",
};

const toGeminiSchema = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => toGeminiSchema(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const schema = value as Record<string, unknown>;
  const mapped: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(schema)) {
    if (key === "strict") {
      continue;
    }

    if (key === "type" && typeof raw === "string") {
      mapped.type = typeMap[raw] || raw;
      continue;
    }

    if (key === "properties" && raw && typeof raw === "object") {
      mapped.properties = Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([propKey, propValue]) => [
          propKey,
          toGeminiSchema(propValue),
        ])
      );
      continue;
    }

    if (
      (key === "items" ||
        key === "additionalProperties" ||
        key === "propertyOrdering") &&
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw)
    ) {
      mapped[key] = toGeminiSchema(raw);
      continue;
    }

    if (
      (key === "anyOf" || key === "oneOf" || key === "allOf") &&
      Array.isArray(raw)
    ) {
      mapped[key] = raw.map(item => toGeminiSchema(item));
      continue;
    }

    mapped[key] = raw;
  }

  return mapped;
};

const buildGenerationConfig = (
  params: InvokeParams,
  normalizedResponseFormat: GeminiResponseFormat | undefined
) => {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: params.maxTokens ?? params.max_tokens ?? 32768,
  };

  if (normalizedResponseFormat?.type === "json_object") {
    generationConfig.responseMimeType = "application/json";
  }

  if (normalizedResponseFormat?.type === "json_schema") {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = toGeminiSchema(
      normalizedResponseFormat.json_schema.schema
    );
  }

  return generationConfig;
};

const extractCandidateText = (responseBody: Record<string, unknown>): string => {
  const candidates = responseBody.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const promptFeedback = responseBody.promptFeedback;
    throw new Error(
      `Gemini returned no candidates${
        promptFeedback ? `: ${JSON.stringify(promptFeedback)}` : ""
      }`
    );
  }

  const firstCandidate = candidates[0] as Record<string, unknown>;
  const content = firstCandidate.content as Record<string, unknown> | undefined;
  const parts = content?.parts;

  if (!Array.isArray(parts) || parts.length === 0) {
    return "";
  }

  return parts
    .map(part => {
      if (!part || typeof part !== "object") return "";
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string") return text;
      return JSON.stringify(part);
    })
    .filter(Boolean)
    .join("\n");
};

const mapFinishReason = (finishReason: unknown): string | null => {
  if (typeof finishReason !== "string" || !finishReason) {
    return null;
  }

  switch (finishReason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    default:
      return finishReason.toLowerCase();
  }
};

const buildInvokeResult = (
  responseBody: Record<string, unknown>,
  model: string,
  content: string
): InvokeResult => {
  const usage = responseBody.usageMetadata as Record<string, unknown> | undefined;
  const candidates = Array.isArray(responseBody.candidates)
    ? responseBody.candidates
    : [];
  const finishReason = mapFinishReason(
    (candidates[0] as Record<string, unknown> | undefined)?.finishReason
  );

  return {
    id:
      typeof responseBody.responseId === "string"
        ? responseBody.responseId
        : `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: finishReason,
      },
    ],
    usage: usage
      ? {
          prompt_tokens: Number(usage.promptTokenCount ?? 0),
          completion_tokens: Number(usage.candidatesTokenCount ?? 0),
          total_tokens: Number(usage.totalTokenCount ?? 0),
        }
      : undefined,
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const normalizedToolChoice = normalizeToolChoice(
    params.toolChoice || params.tool_choice,
    params.tools
  );
  if (params.tools?.length || normalizedToolChoice) {
    throw new Error("Direct Gemini mode does not support tool calls in invokeLLM");
  }

  const model = resolveModel();
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat: params.responseFormat,
    response_format: params.response_format,
    outputSchema: params.outputSchema,
    output_schema: params.output_schema,
  });

  const payload: Record<string, unknown> = {
    contents: buildGeminiContents(params.messages),
    generationConfig: buildGenerationConfig(params, normalizedResponseFormat),
  };

  const systemInstruction = extractSystemInstruction(params.messages);
  if (systemInstruction) {
    payload.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(resolveApiUrl(model), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini invoke failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const responseBody = (await response.json()) as Record<string, unknown>;
  const content = extractCandidateText(responseBody);
  return buildInvokeResult(responseBody, model, content);
}
