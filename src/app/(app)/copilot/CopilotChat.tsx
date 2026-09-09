"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EXAMPLE_QUESTIONS } from "@/lib/ai/example-questions";

interface Message {
  role: "user" | "assistant";
  text: string;
  intent?: string;
}

export function CopilotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", text: body.answer ?? body.error ?? "Something went wrong.", intent: body.intent }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-2 text-xs font-medium text-text-muted">Try asking:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="rounded-full border border-border px-3 py-1 text-xs text-text hover:bg-bg"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="min-h-[300px] space-y-3">
          {messages.length === 0 && <p className="text-sm text-text-muted">Ask a question about your inventory, sales, or recommendations.</p>}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-lg rounded-xl px-3.5 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-white" : "bg-bg text-text"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && <p className="text-sm text-text-muted">Thinking...</p>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your business..."
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button type="submit" variant="primary" disabled={loading}>
            Ask
          </Button>
        </form>
      </Card>

      <p className="text-xs text-text-muted">
        Answers are grounded in your database — every number comes from a real query, not a guess. Ask about slow-moving stock, dead
        stock, order recommendations, sales, aging, or top customers.
      </p>
    </div>
  );
}
