import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { answerQuestion } from "@/lib/ai/copilot";
import { maybeRephraseWithLLM } from "@/lib/ai/llm-client";

const bodySchema = z.object({ question: z.string().min(1).max(500) });

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const result = await answerQuestion(user.businessId, parsed.data.question);
  const answer = await maybeRephraseWithLLM(parsed.data.question, result.answer, result.data);

  return NextResponse.json({ answer, groundedAnswer: result.answer, intent: result.intent, data: result.data });
}
