import { CopilotChat } from "./CopilotChat";

export default function CopilotPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">AI Business Copilot</h1>
        <p className="text-sm text-text-muted">Ask questions in plain language — answers are grounded in your actual data.</p>
      </div>
      <CopilotChat />
    </div>
  );
}
