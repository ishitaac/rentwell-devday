import type { AskReply, AskRequest } from "./lib/lanes";
import type { AnalysisResult } from "./lib/types";

/** Browser-side calls to the /api functions. No key or model code lives here. */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const ANALYZE_TIMEOUT_MS = 50_000; // parallel calls capped at 20 s each, plus one possible retry
const ASK_TIMEOUT_MS = 30_000;

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    if (!response.ok || !data) {
      throw new ApiError(data?.error?.code ?? "network", data?.error?.message ?? "Fine Print couldn't be reached.");
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("timeout", "That took too long.");
    }
    throw new ApiError("network", "Fine Print couldn't be reached. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

export const analyzeLeaseText = (leaseText: string) =>
  post<AnalysisResult>("/api/analyze", { leaseText }, ANALYZE_TIMEOUT_MS);

export const askFinePrint = (request: AskRequest) => post<AskReply>("/api/ask", request, ASK_TIMEOUT_MS);
