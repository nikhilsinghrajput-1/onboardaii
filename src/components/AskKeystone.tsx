import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askKeystone } from "@/lib/ai.functions";

type Turn = { role: "you" | "keystone"; text: string };

const SUGGESTIONS = [
  "Who is blocked right now?",
  "What still needs approval?",
  "Which tools failed today?",
];

export function AskKeystone({ orgId }: { orgId: string | undefined }) {
  const ask = useServerFn(askKeystone);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const mutation = useMutation({
    mutationFn: (q: string) => ask({ data: { orgId: orgId!, question: q } }),
    onSuccess: (res) =>
      setTurns((prev) => [
        ...prev,
        { role: "keystone", text: res.error ?? res.answer },
      ]),
    onError: () =>
      setTurns((prev) => [...prev, { role: "keystone", text: "Could not answer that just now." }]),
  });

  const send = (q: string) => {
    const trimmed = q.trim();
    if (!orgId || trimmed.length < 3) return;
    setTurns((prev) => [...prev, { role: "you", text: trimmed }]);
    setQuestion("");
    mutation.mutate(trimmed);
  };

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-primary" />
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Ask Keystone
        </h2>
      </div>

      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
        {turns.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask about hires, tasks or blockers — answered from live data only.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={`${turn.role}-${i}`} className="text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {turn.role}
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{turn.text}</p>
          </div>
        ))}
        {mutation.isPending && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Is Nikhil ready for day one?"
        />
        <Button type="submit" size="icon" disabled={mutation.isPending}>
          <Send />
        </Button>
      </form>
    </section>
  );
}
