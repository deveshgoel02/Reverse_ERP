/** Shared with the client (CopilotChat.tsx) — kept separate from copilot.ts so importing it never pulls Prisma into the client bundle. */
export const EXAMPLE_QUESTIONS = [
  "Which products are moving slowly?",
  "How much stock is currently stuck?",
  "What should I order next?",
  "Which products should I reduce?",
  "Which products haven't sold in 90 days?",
  "Show me stock older than 180 days.",
  "What were the best-selling products last year?",
  "Which customers bought the most?",
  "Which brand has the highest inventory risk?",
];
