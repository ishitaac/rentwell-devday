import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ModelError } from "../anthropic.js";

/** Vision call for Walkthrough. Separate from Fine Print's helper so neither can break the other. Server-only. */

export const visionModel = () => process.env.VISION_MODEL || "claude-sonnet-5-5";
const visionEffort = (): "low" | "medium" | "high" => {
  const value = process.env.VISION_EFFORT;
  return value === "medium" || value === "high" ? value : "low";
};

let client: Anthropic | null = null;

function getClient(timeoutMs: number): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new ModelError("no_key", "Model key is not configured");
  client ??= new Anthropic({ maxRetries: 0 });
  return client.withOptions({ timeout: timeoutMs });
}

export interface VisionCall<S extends z.ZodType> {
  system: string;
  text: string;
  imageBase64: string;
  schema: S;
  timeoutMs: number;
}

export type VisionFn = <S extends z.ZodType>(call: VisionCall<S>) => Promise<unknown>;

export const callVision: VisionFn = async (call) => {
  const model = visionModel();
  const anthropic = getClient(call.timeoutMs);
  const fallback = model.includes("haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  try {
    const response = await anthropic.beta.messages.parse({
      model,
      max_tokens: 4000,
      output_config: { effort: visionEffort(), format: betaZodOutputFormat(call.schema) },
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: call.imageBase64 },
            },
            { type: "text", text: call.text },
          ],
        },
      ],
      ...fallback,
    });
    if (response.stop_reason === "refusal") throw new ModelError("refused", "The model declined");
    if (response.stop_reason === "max_tokens")
      throw new ModelError("bad_output", "Output was cut off");
    if (response.parsed_output == null)
      throw new ModelError("bad_output", "Output did not match schema");
    return response.parsed_output;
  } catch (error) {
    if (error instanceof ModelError) throw error;
    if (error instanceof Anthropic.APIConnectionTimeoutError)
      throw new ModelError("timeout", "Model call timed out");
    if (error instanceof Anthropic.RateLimitError)
      throw new ModelError("rate_limited", "Model is busy");
    if (error instanceof Anthropic.BadRequestError)
      throw new ModelError("upstream", "The photo could not be read");
    if (error instanceof Anthropic.APIError)
      throw new ModelError("upstream", `Model API error ${error.status ?? ""}`);
    throw new ModelError("bad_output", "Unexpected model failure");
  }
};
