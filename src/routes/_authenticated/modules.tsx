import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { NewCandidateDialog } from "@/components/NewCandidateDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  candidateProgressQuery,
  candidatesQuery,
  tracksQuery,
  STAGE_LABEL,
} from "@/lib/modules-data";
import { generateTrack, resendCandidateInvite } from "@/lib/modules.functions";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/modules")({
  head: () => ({
    meta: [
      { title: "Modules · Keystone candidate learning tracks" },
      {
        name: "description",
        content:
          "Assign role-based learning modules to candidates, track completion and review AI-graded assessments inside Keystone.",
      },
      { property: "og:title", content: "Keystone modules" },
      {
        property: "og:description",
        content:
          "Role-based candidate module tracks, completion tracking and AI-graded assessments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModulesPage,
});

function ModulesPage() {
  const { activeOrg } = useOrgContext();
  const orgId = activeOrg?.id;
  const queryClient = useQueryClient();
  const candidates = useQuery(candidatesQuery(orgId));
  const tracks = useQuery(tracksQuery(orgId));
  const progress = useQuery(candidateProgressQuery(orgId));
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");

  const resend = useServerFn(resendCandidateInvite);
  const draft = useServerFn(generateTrack);

  const resendMutation = useMutation({
    mutationFn: (candidateId: string) =>
      resend({ data: { orgId: orgId!, candidateId, appOrigin: window.location.origin } }),
    onSuccess: (res) => {
      if (res.ok) toast.success("Invite resent with a fresh password");
      else toast.error("Invite failed", { description: res.error ?? "Check your mail connector." });
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not resend"),
  });

  const draftMutation = useMutation({
    mutationFn: () => draft({ data: { orgId: orgId!, role: newRole, department: newDept } }),
    onSuccess: (res) => {
      toast.success(`Track ready: ${res.title}`, {
        description: res.ai ? "Drafted with AI." : "Drafted from the standard template.",
      });
      setNewRole("");
      setNewDept("");
      void queryClient.invalidateQueries({ queryKey: ["module-tracks"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not draft a track"),
  });

  const itemsByTrack = new Map<string, number>();
  for (const item of tracks.data?.items ?? []) {
    itemsByTrack.set(item.track_id, (itemsByTrack.get(item.track_id) ?? 0) + 1);
  }
  const doneByCandidate = new Map<string, number>();
  for (const row of progress.data?.progress ?? []) {
    if (row.status !== "completed") continue;
    doneByCandidate.set(row.candidate_id, (doneByCandidate.get(row.candidate_id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every candidate gets a Keystone account, the module track for the role they applied for,
            and an assessment that unlocks once the modules are done.
          </p>
        </div>
        <div className="ml-auto">
          <NewCandidateDialog orgId={orgId} />
        </div>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Candidates
        </h2>
        {candidates.isLoading && <Skeleton className="h-24 w-full" />}
        {candidates.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No candidates yet. Add one and Keystone invites them straight away.
          </p>
        )}
        {candidates.data?.map((candidate) => {
          const total = candidate.track_id ? (itemsByTrack.get(candidate.track_id) ?? 0) : 0;
          const done = doneByCandidate.get(candidate.id) ?? 0;
          const assessment = progress.data?.assessments.find((a) => a.candidate_id === candidate.id);
          const trackTitle = tracks.data?.tracks.find((t) => t.id === candidate.track_id)?.title;
          return (
            <div
              key={candidate.id}
              className="rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-56">
                  <p className="font-medium">{candidate.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {candidate.role} · {candidate.department}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{candidate.email}</p>
                </div>
                <div className="min-w-52">
                  <p className="font-mono text-xs text-muted-foreground">
                    {trackTitle ?? "no track assigned"}
                  </p>
                  <Progress className="mt-2 h-1.5" value={total ? (done / total) * 100 : 0} />
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {done}/{total} modules
                  </p>
                </div>
                <div className="min-w-40">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {STAGE_LABEL[candidate.stage] ?? candidate.stage}
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {assessment?.status === "graded"
                      ? `${assessment.score}/${assessment.max_score}`
                      : "assessment pending"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {candidate.invite_error && (
                    <span className="font-mono text-[11px] text-destructive">invite failed</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resendMutation.isPending}
                    onClick={() => resendMutation.mutate(candidate.id)}
                  >
                    Resend invite
                  </Button>
                </div>
              </div>
              {assessment?.ai_feedback && (
                <p className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  {assessment.ai_feedback}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Module tracks
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card p-4">
          <div className="w-56">
            <label className="font-mono text-[11px] uppercase text-muted-foreground" htmlFor="tr-role">
              Role
            </label>
            <Input
              id="tr-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Backend Engineer"
            />
          </div>
          <div className="w-48">
            <label className="font-mono text-[11px] uppercase text-muted-foreground" htmlFor="tr-dept">
              Department
            </label>
            <Input
              id="tr-dept"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="Engineering"
            />
          </div>
          <Button
            size="sm"
            disabled={!newRole.trim() || draftMutation.isPending || !orgId}
            onClick={() => draftMutation.mutate()}
          >
            {draftMutation.isPending ? "Drafting…" : "Draft track with AI"}
          </Button>
        </div>

        {tracks.isLoading && <Skeleton className="mt-3 h-24 w-full" />}
        <Accordion type="single" collapsible className="mt-3">
          {tracks.data?.tracks.map((track) => {
            const items = (tracks.data?.items ?? []).filter((i) => i.track_id === track.id);
            return (
              <AccordionItem key={track.id} value={track.id}>
                <AccordionTrigger>
                  <span className="flex flex-1 flex-wrap items-center gap-3 text-left">
                    <span className="font-medium">{track.title}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {track.role_key} · {items.length} modules · {track.source}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {track.summary && (
                    <p className="mb-3 text-sm text-muted-foreground">{track.summary}</p>
                  )}
                  <ol className="space-y-2">
                    {items.map((item, index) => (
                      <li key={item.id} className="rounded-lg border border-border/60 p-3">
                        <p className="text-sm font-medium">
                          <span className="font-mono text-xs text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </span>{" "}
                          {item.title}
                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                            {item.duration_minutes} min
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.content}</p>
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
    </main>
  );
}
