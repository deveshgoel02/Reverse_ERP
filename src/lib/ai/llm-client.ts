/**
 * Optional LLM phrasing layer for the AI Copilot. This is additive only —
 * it may rewrite HOW the grounded answer from src/lib/ai/copilot.ts reads,
 * never WHAT it says numerically. If ANTHROPIC_API_KEY is unset, or the
 * call fails for any reason (network, rate limit, bad response), this
 * silently falls back to the grounded template answer unchanged — the
 * copilot must keep working without this (spec Module 20: "if AI service
 * is unavailable, the core application must continue working").
 *
 * Uses a plain fetch call rather than the Anthropic SDK to avoid an extra
 * dependency for what is a single, narrow call.
 */
export async function maybeRephraseWithLLM(question: string, groundedAnswer: string, data: unknown): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return groundedAnswer;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system:
          "You rephrase inventory-system answers for a small business owner. You are given a QUESTION, a FACTUAL ANSWER already computed from the database, and the raw DATA behind it. " +
          "Rewrite the FACTUAL ANSWER to be clear and conversational. You MUST NOT change, add, or remove any number, name, or fact — only improve phrasing and structure. " +
          "If the factual answer says something couldn't be found, keep that meaning. Reply with only the rewritten answer, no preamble.",
        messages: [
          {
            role: "user",
            content: `QUESTION: ${question}\n\nFACTUAL ANSWER: ${groundedAnswer}\n\nDATA: ${JSON.stringify(data).slice(0, 4000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return groundedAnswer;
    const body = await response.json();
    const text = body?.content?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : groundedAnswer;
  } catch {
    return groundedAnswer;
  }
}
