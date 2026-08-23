import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addBackgroundClaim,
  attachClaimEvidence,
  decideBackgroundClaim,
  openBackgroundCheck,
  runVerification,
} from "@/lib/background-check.functions";
import { hiresQuery } from "@/lib/dashboard-data";
import {
  CATEGORY_LABEL,
  CHECK_TONE,
  VERDICT_LABEL,
  VERDICT_TONE,
  checksQuery,
  claimsQuery,
  type Verdict,
} from "@/lib/insights-data";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/background-checks")({
  head: () => ({
    meta: [
      { title: "Background checks · Keystone" },
      {
        name: "description",
        content:
          "Verify what a new hire claimed: identity, employment history, education, certifications, references and public profiles, each with an AI finding and a human verdict.",
      },
      { property: "og:title", content: "Background checks · Keystone" },
      {
        property: "og:description",
        content:
          "AI-assisted resume verification with a risk score and a human decision on every claim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BackgroundChecksPage,
});

const VERDICTS: Verdict[] = ["verified", "unverified", "discrepancy"];

function BackgroundChecksPage() {
  const { activeOrg } = useOrgContext();
  const orgId = activeOrg?.id;
  const queryClient = useQueryClient();

  const hires = useQuery(hiresQuery(orgId));
  const checks = useQuery(checksQuery(orgId));
  const [selectedHire, setSelectedHire] = useState<string | undefined>(undefined);

  const openCheck = useServerFn(openBackgroundCheck);
  const verify = useServerFn(runVerification);
  const decide = useServerFn(decideBackgroundClaim);
  const addClaim = useServerFn(addBackgroundClaim);
  const attach = useServerFn(attachClaimEvidence);

  const hireId = selectedHire ?? hires.data?.[0]?.id;
  const hire = hires.data?.find((h) => h.id === hireId);
  const check = checks.data?.find((c) => c.hire_id === hireId);
  const claims = useQuery(claimsQuery(orgId, check?.id));

  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("employment");
  const [newClaim, setNewClaim] = useState("");
  const [evidenceDraft, setEvidenceDraft] = useState<Record<string, string>>({});

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["background-checks", orgId] });
    await queryClient.invalidateQueries({ queryKey: ["background-claims", orgId] });
  };

  const guard = async (label: string, fn: () => Promise<unknown>) => {
    if (!orgId) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Background checks</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every claim a candidate made gets its own line: attach the evidence you collected, let
            Keystone review it, and record a human verdict. Nothing clears without a person signing
            off.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={hireId ?? ""} onValueChange={setSelectedHire}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a hire" />
            </SelectTrigger>
            <SelectContent>
              {(hires.data ?? []).map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.full_name} · {h.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hires.isLoading && <Skeleton className="mt-8 h-32 w-full" />}
      {hires.data?.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hires yet. Add one on the Overview and you can start verifying them here.
        </p>
      )}

      {hire && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-card p-5">
            <div>
              <p className="font-medium">{hire.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {hire.role} · {hire.department}
              </p>
            </div>
            {check ? (
              <>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase ${CHECK_TONE[check.status]}`}
                >
                  {check.status}
                </span>
                <div className="flex items-center gap-2">
                  {check.risk_score >= 34 ? (
                    <ShieldAlert className="size-4 text-destructive" />
                  ) : (
                    <ShieldCheck className="size-4 text-ok" />
                  )}
                  <span className="font-mono text-sm">risk {check.risk_score}/100</span>
                </div>
                <Button
                  className="ml-auto"
                  disabled={busy}
                  onClick={() =>
                    guard("Verification finished", () =>
                      verify({ data: { orgId: orgId!, checkId: check.id } }),
                    )
                  }
                >
                  <Sparkles />
                  Run AI verification
                </Button>
              </>
            ) : (
              <Button
                className="ml-auto"
                disabled={busy}
                onClick={() =>
                  guard("Background check opened", () =>
                    openCheck({ data: { orgId: orgId!, hireId: hire.id } }),
                  )
                }
              >
                Open background check
              </Button>
            )}
          </div>

          {check?.ai_error && (
            <p className="text-sm text-muted-foreground">{check.ai_error}</p>
          )}
          {check?.summary && (
            <div
              className="rounded-2xl border border-primary/25 p-5"
              style={{ backgroundImage: "var(--gradient-keystone)" }}
            >
              <h2 className="text-sm font-medium uppercase tracking-wide text-primary">
                Keystone finding
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed">{check.summary}</p>
            </div>
          )}

          {check && (
            <div className="space-y-3">
              {claims.isLoading && <Skeleton className="h-24 w-full" />}
              {claims.data?.map((claim) => (
                <article key={claim.id} className="rounded-2xl border border-border/70 bg-card p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABEL[claim.category] ?? claim.category}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${VERDICT_TONE[claim.verdict]}`}
                    >
                      {VERDICT_LABEL[claim.verdict]}
                    </span>
                    {claim.confidence !== null && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        confidence {Math.round(claim.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm">{claim.claim}</p>
                  {claim.finding && (
                    <p className="mt-2 text-sm text-muted-foreground">{claim.finding}</p>
                  )}

                  <div className="mt-3 grid gap-2">
                    <Textarea
                      rows={2}
                      placeholder="Paste the evidence you collected — offer letter dates, degree certificate, reference call notes…"
                      value={evidenceDraft[claim.id] ?? claim.evidence ?? ""}
                      onChange={(e) =>
                        setEvidenceDraft((prev) => ({ ...prev, [claim.id]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || !(evidenceDraft[claim.id] ?? "").trim()}
                        onClick={() =>
                          guard("Evidence attached", () =>
                            attach({
                              data: {
                                orgId: orgId!,
                                claimId: claim.id,
                                evidence: evidenceDraft[claim.id]!.trim(),
                              },
                            }),
                          )
                        }
                      >
                        Save evidence
                      </Button>
                      <span className="mx-1 text-xs text-muted-foreground">Human verdict:</span>
                      {VERDICTS.map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant={claim.verdict === v ? "default" : "outline"}
                          disabled={busy}
                          onClick={() =>
                            guard(`Marked ${VERDICT_LABEL[v].toLowerCase()}`, () =>
                              decide({
                                data: { orgId: orgId!, claimId: claim.id, verdict: v },
                              }),
                            )
                          }
                        >
                          {VERDICT_LABEL[v]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}

              <div className="rounded-2xl border border-dashed border-border p-5">
                <h3 className="text-sm font-medium">Add another claim to verify</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="min-w-64 flex-1"
                    placeholder='e.g. "Led the payments team at Zeta from 2022 to 2025"'
                    value={newClaim}
                    onChange={(e) => setNewClaim(e.target.value)}
                  />
                  <Button
                    disabled={busy || newClaim.trim().length < 3}
                    onClick={() =>
                      guard("Claim added", async () => {
                        await addClaim({
                          data: {
                            orgId: orgId!,
                            checkId: check.id,
                            category: newCategory,
                            claim: newClaim.trim(),
                          },
                        });
                        setNewClaim("");
                      })
                    }
                  >
                    <Plus />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
