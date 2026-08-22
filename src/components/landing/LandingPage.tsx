import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  FileStack,
  Gauge,
  KeyRound,
  MessageSquareDashed,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#workflow" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];

const TOOLS = [
  "Slack",
  "Gmail",
  "Google Calendar",
  "Google Drive",
  "Google Sheets",
  "Notion",
  "Microsoft Teams",
  "Outlook",
];

const BEFORE = [
  "Seven tools, seven checklists, zero source of truth.",
  "HR chases IT in DMs: “did anyone add them to Slack?”",
  "Sensitive access granted informally, with no paper trail.",
  "Failures found on day one — by the new hire.",
];

const AFTER = [
  "One hire record that every tool writes back into.",
  "Provisioning runs itself, step by step, in order.",
  "PII, on-call and reporting access gated by a human approval.",
  "Every action logged with tool, outcome and timestamp.",
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Daily AI briefing",
    body: "Every morning Keystone reads every hire, task, failure and pending approval, then writes a plain-English summary with next actions.",
  },
  {
    icon: BrainCircuit,
    title: "AI onboarding plan",
    body: "Create a hire and AI proposes a role-aware checklist across every connected tool. Review it, tweak it, run it.",
  },
  {
    icon: ShieldCheck,
    title: "Approval risk copilot",
    body: "Each pending approval gets a risk level, a recommendation and reasoning. You still click approve — now you know why.",
  },
  {
    icon: MessageSquareDashed,
    title: "Ask Keystone",
    body: "Chat with live onboarding data. “Who starts Monday?” “What failed for Nikhil?” “Re-run Drive provisioning.”",
  },
  {
    icon: ScrollText,
    title: "Activity log",
    body: "Provisioning is auditable by default: tool, hire, outcome and timestamp for every step Keystone takes.",
  },
  {
    icon: Gauge,
    title: "Live tool health",
    body: "Each connector reports green, amber or red with last-success timestamps, so a broken token never hides.",
  },
];

const STEPS = [
  { title: "Create the hire", body: "Name, role, start date, team lead. One record, one owner." },
  { title: "AI proposes the plan", body: "A role-aware checklist across Slack, Gmail, Calendar, Drive, Sheets, Notion and Teams." },
  { title: "The runner executes", body: "Steps run in order: workspace invite, channel, welcome mail, Day-1 orientation, folders, tracker rows." },
  { title: "Sensitive steps pause", body: "PII access, on-call and direct reports route to the approval queue instead of being granted quietly." },
  { title: "Humans decide", body: "Approvers act in the app with AI risk context attached to each request." },
  { title: "The board stays live", body: "Progress, health and activity update in real time until the hire is fully ready." },
];

const STATS = [
  { value: "8", label: "tools orchestrated" },
  { value: "12+", label: "steps automated per hire" },
  { value: "100%", label: "actions written to the audit log" },
  { value: "0", label: "spreadsheets required" },
];

const SECURITY = [
  { icon: KeyRound, title: "Least privilege", body: "Row-level security on every table; members only read their organisation's data." },
  { icon: ShieldCheck, title: "Human gates", body: "PII, on-call and direct-report access always require an explicit approval." },
  { icon: ScrollText, title: "Full audit trail", body: "Every provisioning action is recorded and queryable, with outcome and timestamp." },
  { icon: FileStack, title: "No shadow IT", body: "Connections live at the workspace level with keys injected at runtime, never in code." },
];

const FAQ = [
  {
    q: "Who is Keystone for?",
    a: "Internal operations, HR and IT at Acropolis. It is a single-tenant control room, not a public SaaS product.",
  },
  {
    q: "Does it replace our tools?",
    a: "No. Keystone orchestrates the tools you already use — Slack, Gmail, Calendar, Drive, Sheets, Notion, Teams and Outlook — and keeps one record of what happened in each.",
  },
  {
    q: "What does the AI actually do?",
    a: "Three things: it drafts the onboarding plan for a role, it writes the daily briefing, and it advises on approval risk. Every decision stays with a human.",
  },
  {
    q: "What happens when a step fails?",
    a: "The step is marked failed with its error, it surfaces on the dashboard and in the briefing, and you can re-run just that hire's provisioning.",
  },
  {
    q: "How do approvals work?",
    a: "Sensitive steps create an approval request with AI risk context. Approvers decide in the app, and the runner continues from where it paused.",
  },
];

function Dot({ tone }: { tone: "ok" | "run" | "wait" }) {
  const cls = tone === "ok" ? "bg-ok" : tone === "run" ? "bg-run" : "bg-wait";
  return <span className={`inline-block size-2 rounded-full ${cls}`} aria-hidden="true" />;
}

function HeroPanel() {
  return (
    <Card className="border-border/70 bg-card/80 backdrop-blur">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
            Control room
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">live</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-md border border-border/60 bg-background/40 p-3">
              <p className="font-mono text-xl tabular-nums text-foreground">{s.value}</p>
              <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {[
            { name: "Slack · workspace invite", tone: "ok" as const, note: "done" },
            { name: "Gmail · welcome email", tone: "ok" as const, note: "done" },
            { name: "Calendar · Day-1 orientation", tone: "run" as const, note: "running" },
            { name: "Drive · onboarding folder", tone: "wait" as const, note: "approval" },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Dot tone={row.tone} />
                {row.name}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {row.note}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            AI briefing
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Nikhil needs a workspace invite before channel access. Three approvals are waiting on
            PII-sensitive roles. No failed runs today.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Workflow className="size-4" aria-hidden="true" />
            </span>
            <span className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-foreground">
              Keystone
            </span>
          </Link>

          <nav aria-label="Main" className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/dashboard">
                Open control room
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section id="product" className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "var(--gradient-keystone)" }}
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
            <div>
              <Badge variant="outline" className="border-primary/40 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                Internal onboarding operations
              </Badge>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                One hire. One record.
                <br />
                Every tool. Zero chaos.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Keystone provisions, tracks, approves and reports every onboarding step across Slack,
                Gmail, Calendar, Drive, Sheets, Notion and Teams — with AI briefings and human
                approvals where they matter.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    Open control room
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#workflow">See the workflow</a>
                </Button>
              </div>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                Built for Acropolis · access by member list only
              </p>
            </div>

            <HeroPanel />
          </div>
        </section>

        {/* Trust strip */}
        <section aria-label="Connected tools" className="border-y border-border/70 bg-card/40">
          <div className="mx-auto max-w-6xl px-5 py-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Orchestrates
            </p>
            <ul className="mt-3 flex flex-wrap items-center gap-x-7 gap-y-3">
              {TOOLS.map((tool) => (
                <li key={tool} className="flex items-center gap-2 text-sm text-foreground/80">
                  <Dot tone="ok" />
                  {tool}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Before / after */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Onboarding is an operations problem, not a checklist
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            The work already happens across a dozen systems. Keystone gives it a spine.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Card className="border-destructive/25 bg-card/60">
              <CardContent className="p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-destructive">
                  Before Keystone
                </p>
                <ul className="mt-4 space-y-3">
                  {BEFORE.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-card/60">
              <CardContent className="p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                  With Keystone
                </p>
                <ul className="mt-4 space-y-3">
                  {AFTER.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y border-border/70 bg-card/30">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              A control room, with a copilot inside it
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Six capabilities that turn provisioning into something you can read at a glance.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="border-border/70 bg-background/50">
                  <CardContent className="p-6">
                    <span className="grid size-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From offer accepted to fully ready
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Six steps, always in the same order, always recorded.
          </p>

          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-lg border border-border/70 bg-card/50 p-6"
              >
                <span className="font-mono text-sm tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Metrics band */}
        <section className="border-y border-border/70 bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-mono text-4xl tabular-nums text-primary">{s.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section id="security" className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Access you can prove, not just promise
              </h2>
              <p className="mt-4 text-muted-foreground">
                Keystone treats onboarding as a security surface. Every grant has an owner, a reason
                and a timestamp — so an audit is a query, not an archaeology project.
              </p>
              <div className="mt-6 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <Activity className="size-4 text-ok" aria-hidden="true" />
                Real-time status · full history retained
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {SECURITY.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="border-border/70 bg-card/50">
                  <CardContent className="p-5">
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/70 bg-card/30">
          <div className="mx-auto max-w-3xl px-5 py-20">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Questions, answered
            </h2>
            <Accordion type="single" collapsible className="mt-8">
              {FAQ.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <Card className="border-primary/30 bg-card/70">
            <CardContent className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Keystone holds the onboarding world together
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Invisible to the hire. Fully visible to the team.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    Open control room
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">Sign in</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
              Keystone · Acropolis internal
            </span>
            <nav aria-label="Footer" className="flex items-center gap-5">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
              <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
            </nav>
          </div>
          <Separator className="my-6" />
          <p className="text-xs text-muted-foreground">
            Onboarding operations platform for Acropolis. Access limited to organisation members.
          </p>
        </div>
      </footer>
    </div>
  );
}
