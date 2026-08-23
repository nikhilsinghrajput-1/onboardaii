import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMyModules, setModuleProgress, submitAssessment } from "@/lib/modules.functions";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Your modules · Keystone" },
      {
        name: "description",
        content:
          "Work through the onboarding modules assigned to you, then take the assessment — your Keystone candidate portal.",
      },
      { property: "og:title", content: "Your Keystone modules" },
      {
        property: "og:description",
        content: "Assigned onboarding modules and the assessment that unlocks once you finish them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(getMyModules);
  const mark = useServerFn(setModuleProgress);
  const submit = useServerFn(submitAssessment);
  const space = useQuery({ queryKey: ["my-modules"], queryFn: () => load({}) });
  const [open, setOpen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { choiceIndex?: number; text?: string }>>({});

  const progressMutation = useMutation({
    mutationFn: (vars: { moduleItemId: string; done: boolean }) => mark({ data: vars }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-modules"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save progress"),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          answers: Object.entries(answers).map(([questionId, a]) => ({
            questionId,
            choiceIndex: a.choiceIndex ?? null,
            text: a.text ?? "",
          })),
        },
      }),
    onSuccess: (res) => {
      toast.success(`Submitted — you scored ${res.score}/${res.maxScore}`);
      void queryClient.invalidateQueries({ queryKey: ["my-modules"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  if (space.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const data = space.data;
  if (!data?.candidate) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Nothing assigned yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account has no candidate profile in Keystone yet. If you were expecting modules, ask
          your recruiter to resend the invite.
        </p>
      </main>
    );
  }

  const total = data.items.length;
  const done = data.items.filter((i) => i.done).length;
  const allDone = total > 0 && done === total;
  const graded = data.assessment?.status === "graded";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Hi {data.candidate.full_name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.track?.title ?? "Your modules"} · applying for {data.candidate.role}
      </p>
      {data.track?.summary && (
        <p className="mt-2 text-sm text-muted-foreground">{data.track.summary}</p>
      )}

      <div className="mt-6 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Progress
          </span>
          <span className="font-mono text-sm">
            {done}/{total}
          </span>
        </div>
        <Progress className="mt-3 h-2" value={total ? (done / total) * 100 : 0} />
      </div>

      <section className="mt-6 space-y-3">
        {data.items.map((item, index) => (
          <div key={item.id} className="rounded-xl border border-border/70 bg-card p-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => setOpen(open === item.id ? null : item.id)}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${
                  item.done ? "bg-ok/15 text-ok" : "bg-muted text-muted-foreground"
                }`}
              >
                {item.done ? "✓" : index + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{item.title}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {item.duration_minutes} min
              </span>
            </button>
            {open === item.id && (
              <div className="mt-3 border-t border-border/60 pt-3">
                <p className="whitespace-pre-line text-sm text-muted-foreground">{item.content}</p>
                <Button
                  size="sm"
                  className="mt-3"
                  variant={item.done ? "outline" : "default"}
                  disabled={progressMutation.isPending}
                  onClick={() =>
                    progressMutation.mutate({ moduleItemId: item.id, done: !item.done })
                  }
                >
                  {item.done ? "Mark as not done" : "Mark complete"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-border/70 bg-card p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Assessment
        </h2>

        {graded && (
          <div className="mt-3">
            <p className="font-mono text-2xl text-ok">
              {data.assessment?.score}/{data.assessment?.max_score}
            </p>
            {data.assessment?.ai_feedback && (
              <p className="mt-2 text-sm text-muted-foreground">{data.assessment.ai_feedback}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Submitted — the Acropolis team can see your result.
            </p>
          </div>
        )}

        {!graded && !allDone && (
          <p className="mt-3 text-sm text-muted-foreground">
            Complete all {total} modules to unlock the assessment.
          </p>
        )}

        {!graded && allDone && data.questions.length > 0 && (
          <form
            className="mt-4 space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (!submitMutation.isPending) submitMutation.mutate();
            }}
          >
            {data.questions.map((q, index) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>{" "}
                  {q.prompt}
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    {q.points} pt{q.points === 1 ? "" : "s"}
                  </span>
                </p>
                {q.kind === "mcq" ? (
                  <RadioGroup
                    value={answers[q.id]?.choiceIndex?.toString() ?? ""}
                    onValueChange={(value) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: { choiceIndex: Number(value) },
                      }))
                    }
                  >
                    {q.options.map((option, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <RadioGroupItem id={`${q.id}-${oi}`} value={oi.toString()} />
                        <Label htmlFor={`${q.id}-${oi}`} className="text-sm font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea
                    rows={5}
                    value={answers[q.id]?.text ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: { text: e.target.value } }))
                    }
                    placeholder="Write your answer…"
                  />
                )}
              </div>
            ))}
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Grading…" : "Submit assessment"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
