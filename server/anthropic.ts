import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/** The only place that talks to the Anthropic API. Server-only. */

export const MODEL_TIMEOUT_MS = Number(process.env.FINE_PRINT_TIMEOUT_MS) || 20_000;

export const models = {
  main: () => process.env.FINE_PRINT_MODEL || "claude-sonnet-5-5",
  router: () => process.env.FINE_PRINT_ROUTER_MODEL || "claude-haiku-5-5",
};

export class ModelError extends Error {
  constructor(
    readonly code: "no_key" | "timeout" | "rate_limited" | "refused" | "bad_output" | "upstream",
    message: string,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

let client: Anthropic | null = null;

function getClient(timeoutMs: number): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new ModelError("no_key", "Model key is not configured");
  client ??= new Anthropic({ maxRetries: 0 });
  return client.withOptions({ timeout: timeoutMs });
}

interface StructuredCall<S extends z.ZodType> {
  model: string;
  system: string;
  user: string;
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  timeoutMs?: number;
}

export async function callStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S>> {
  const anthropic = getClient(call.timeoutMs ?? MODEL_TIMEOUT_MS);
  // Server-side refusal fallback is only offered on the larger models, not on Haiku.
  const fallback = call.model.includes("haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  try {
    const response = await anthropic.beta.messages.parse({
      model: call.model,
      max_tokens: call.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: call.effort, format: betaZodOutputFormat(call.schema) },
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: call.user }],
      ...fallback,
    });
    if (response.stop_reason === "refusal") throw new ModelError("refused", "The model declined");
    if (response.stop_reason === "max_tokens") throw new ModelError("bad_output", "Output was cut off");
    if (response.parsed_output == null) throw new ModelError("bad_output", "Output did not match schema");
    return response.parsed_output as z.infer<S>;
  } catch (error) {
    throw toModelError(error);
  }
}

function toModelError(error: unknown): ModelError {
  if (error instanceof ModelError) return error;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ModelError("timeout", "Model call timed out");
  if (error instanceof Anthropic.RateLimitError) return new ModelError("rate_limited", "Model is busy");
  if (error instanceof Anthropic.APIError) return new ModelError("upstream", `Model API error ${error.status ?? ""}`);
  return new ModelError("bad_output", "Unexpected model failure");
}
