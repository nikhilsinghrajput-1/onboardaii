import { aiText, parseJsonLoose } from "./ai.server";
import { sendMailForOrg } from "./gmail.server";
import { sendOutlookMail } from "./outlook.server";

export type DraftItem = { title: string; content: string; duration_minutes: number };
export type DraftQuestion = {
  kind: "mcq" | "written";
  prompt: string;
  options: string[];
  correct_index: number | null;
  points: number;
};

export function roleKey(role: string): string {
  return role.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deterministic fallback track so the feature works even when AI is unavailable. */
function fallbackItems(role: string): DraftItem[] {
  return [
    {
      title: "Welcome to Acropolis",
      content: `How we work, what we value, and how your work as a ${role} fits into the wider company.`,
      duration_minutes: 20,
    },
    {
      title: "Tools and access",
      content: "Slack etiquette, calendar norms, document hygiene and how to ask for access.",
      duration_minutes: 25,
    },
    {
      title: `Core skills for ${role}`,
      content: `The day-to-day craft expected from a ${role}: standards, review culture and quality bars.`,
      duration_minutes: 45,
    },
    {
      title: "Security and data handling",
      content: "Handling customer data, secrets, incident reporting and least-privilege access.",
      duration_minutes: 30,
    },
    {
      title: "First 30 days",
      content: "What a strong first month looks like, and how progress is reviewed.",
      duration_minutes: 20,
    },
  ];
}

function fallbackQuestions(role: string, items: DraftItem[]): DraftQuestion[] {
  const first = items[0]?.title ?? "onboarding";
  return [
    {
      kind: "mcq",
      prompt: "Where should sensitive access requests go?",
      options: [
        "Straight to production",
        "Through the approval queue for a human sign-off",
        "Ask a teammate for their credentials",
        "Skip it",
      ],
      correct_index: 1,
      points: 1,
    },
    {
      kind: "mcq",
      prompt: `Which best describes the goal of the "${first}" module?`,
      options: [
        "Learning how we work and where you fit",
        "Memorising the org chart",
        "Nothing in particular",
        "Configuring servers",
      ],
      correct_index: 0,
      points: 1,
    },
    {
      kind: "written",
      prompt: `Describe how you would approach your first week as a ${role} here.`,
      options: [],
      correct_index: null,
      points: 5,
    },
  ];
}

/** Drafts a role-specific module track with AI, falling back to a sane default. */
export async function draftTrack(
  role: string,
  department: string,
): Promise<{ title: string; summary: string; items: DraftItem[]; ai: boolean }> {
  const res = await aiText([
    {
      role: "system",
      content:
        "You design concise onboarding learning tracks for a company called Acropolis. Reply with JSON only.",
    },
    {
      role: "user",
      content: `Create an onboarding module track for a candidate applying for "${role}" in ${department}.
Return JSON: {"title":string,"summary":string,"items":[{"title":string,"content":string,"duration_minutes":number}]}
Use 5 to 6 items. "content" is 2-4 sentences of actual reading material, role specific, no markdown.`,
    },
  ]);
  const parsed = res.ok
    ? parseJsonLoose<{ title?: string; summary?: string; items?: DraftItem[] }>(res.text)
    : null;
  const items = (parsed?.items ?? []).filter((i) => i?.title && i?.content).slice(0, 8);
  if (items.length >= 3) {
    return {
      title: parsed?.title?.trim() || `${role} onboarding track`,
      summary: parsed?.summary?.trim() || `Onboarding modules for ${role}.`,
      items: items.map((i) => ({
        title: String(i.title).slice(0, 200),
        content: String(i.content).slice(0, 4000),
        duration_minutes: Number.isFinite(i.duration_minutes) ? Number(i.duration_minutes) : 20,
      })),
      ai: true,
    };
  }
  return {
    title: `${role} onboarding track`,
    summary: `Onboarding modules for ${role}.`,
    items: fallbackItems(role),
    ai: false,
  };
}

/** Drafts the assessment: multiple-choice plus written questions for the track. */
export async function draftQuestions(
  role: string,
  items: DraftItem[],
): Promise<{ questions: DraftQuestion[]; ai: boolean }> {
  const outline = items.map((i, n) => `${n + 1}. ${i.title}: ${i.content}`).join("\n");
  const res = await aiText([
    {
      role: "system",
      content: "You write fair onboarding assessments. Reply with JSON only.",
    },
    {
      role: "user",
      content: `Modules for a ${role}:\n${outline}\n
Write an assessment: 5 multiple-choice questions (4 options each, one correct) and 2 written questions.
Return JSON: {"questions":[{"kind":"mcq"|"written","prompt":string,"options":string[],"correct_index":number|null,"points":number}]}
MCQ points = 1. Written points = 5. Only test material covered above.`,
    },
  ]);
  const parsed = res.ok ? parseJsonLoose<{ questions?: DraftQuestion[] }>(res.text) : null;
  const clean = (parsed?.questions ?? [])
    .filter((q) => q?.prompt && (q.kind === "mcq" || q.kind === "written"))
    .slice(0, 12)
    .map<DraftQuestion>((q) => ({
      kind: q.kind === "written" ? "written" : "mcq",
      prompt: String(q.prompt).slice(0, 1000),
      options: q.kind === "mcq" ? (q.options ?? []).map((o) => String(o).slice(0, 300)) : [],
      correct_index:
        q.kind === "mcq" && typeof q.correct_index === "number" ? q.correct_index : null,
      points: q.kind === "written" ? 5 : 1,
    }))
    .filter((q) => q.kind === "written" || (q.options.length >= 2 && q.correct_index !== null));
  if (clean.some((q) => q.kind === "mcq") && clean.length >= 3) return { questions: clean, ai: true };
  return { questions: fallbackQuestions(role, items), ai: false };
}

/** AI grading for the written answers. Returns a score per answer plus a summary. */
export async function gradeWritten(
  role: string,
  entries: { id: string; prompt: string; answer: string; points: number }[],
): Promise<{ scores: Record<string, { score: number; feedback: string }>; summary: string }> {
  if (entries.length === 0) return { scores: {}, summary: "" };
  const res = await aiText([
    {
      role: "system",
      content:
        "You grade onboarding assessment answers generously but honestly. Reply with JSON only.",
    },
    {
      role: "user",
      content: `Candidate role: ${role}.
Grade each answer out of its max points.
${entries
  .map((e) => `id=${e.id} max=${e.points}\nQ: ${e.prompt}\nA: ${e.answer || "(no answer)"}`)
  .join("\n\n")}
Return JSON: {"summary":string,"grades":[{"id":string,"score":number,"feedback":string}]}
"summary" is 2-3 sentences for the HR team.`,
    },
  ]);
  const parsed = res.ok
    ? parseJsonLoose<{ summary?: string; grades?: { id: string; score: number; feedback: string }[] }>(
        res.text,
      )
    : null;
  const scores: Record<string, { score: number; feedback: string }> = {};
  for (const g of parsed?.grades ?? []) {
    const entry = entries.find((e) => e.id === g.id);
    if (!entry) continue;
    const raw = Number(g.score);
    scores[g.id] = {
      score: Number.isFinite(raw) ? Math.max(0, Math.min(entry.points, raw)) : 0,
      feedback: String(g.feedback ?? "").slice(0, 1500),
    };
  }
  for (const e of entries) {
    if (!scores[e.id]) {
      const answered = e.answer.trim().length > 40;
      scores[e.id] = {
        score: answered ? Math.round(e.points * 0.6) : 0,
        feedback: answered
          ? "Auto-scored — AI grading was unavailable, please review manually."
          : "No substantive answer given.",
      };
    }
  }
  return { scores, summary: parsed?.summary?.trim() ?? "" };
}

export function inviteEmail(input: {
  fullName: string;
  role: string;
  email: string;
  tempPassword: string | null;
  portalUrl: string;
  trackTitle: string;
}) {
  const first = input.fullName.split(" ")[0] ?? input.fullName;
  const subject = `Your Keystone learning modules — ${input.role} at Acropolis`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111">
    <p>Hi ${first},</p>
    <p>Thanks for applying for <strong>${input.role}</strong> at Acropolis. We've created a Keystone
    account for you so you can work through your assigned modules.</p>
    <p><strong>Your track:</strong> ${input.trackTitle}</p>
    <p><strong>Sign in:</strong> <a href="${input.portalUrl}">${input.portalUrl}</a><br/>
    Email: <strong>${input.email}</strong>${
      input.tempPassword
        ? `<br/>Temporary password: <strong>${input.tempPassword}</strong> (please change it after signing in)`
        : "<br/>Use the password you already set on Keystone."
    }</p>
    <p>Once you've completed every module, the assessment unlocks — a short mix of
    multiple-choice and written questions. Your score goes straight to our team.</p>
    <p>— The Acropolis talent team</p>
  </div>`;
  return { subject, html };
}

/** Sends through Gmail, falling back to Outlook when Gmail is not connected. */
export async function sendCandidateMail(
  orgId: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error: string | null }> {
  const gmail = await sendMailForOrg(orgId, to, subject, html);
  if (gmail.ok) return { ok: true, error: null };
  const outlook = await sendOutlookMail(to, subject, html);
  if (outlook.ok) return { ok: true, error: null };
  return { ok: false, error: outlook.error ?? gmail.error ?? "mail_failed" };
}
