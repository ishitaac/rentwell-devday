/** Detects text that tries to instruct software (prompt injection) in a message or a clause. */

const INJECTION_RE =
  /\b(ignore|disregard|forget)\b[^.]{0,40}\b(instructions?|rules|prompt)\b|\bsystem prompt\b|\byou are now\b|\bdeveloper mode\b|\bnew instructions\b|\b(?:AI|language model|LLM|assistant)s?\b[^.]{0,30}\b(?:must|should|report|output|respond)\b/i;

export function looksLikeInjection(text: string): boolean {
  return INJECTION_RE.test(text);
}
