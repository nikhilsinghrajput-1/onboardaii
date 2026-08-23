import { randomBytes } from "node:crypto";

import { logActivity } from "./gateway.server";
import {
  draftQuestions,
  draftTrack,
  gradeWritten,
  inviteEmail,
  roleKey,
  sendCandidateMail,
} from "./modules.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function tempPassword(): string {
  return `Key-${randomBytes(6).toString("base64url")}-${randomBytes(3).toString("hex")}`;
}

/** Creates (or reuses) the Keystone login for a candidate email. */
async function ensureAuthUser(
  email: string,
  fullName: string,
): Promise<{ userId: string | null; tempPassword: string | null; error: string | null }> {
  const db = await admin();
  const password = tempPassword();
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, keystone_role: "candidate" },
  });
  if (created.data?.user) {
    return { userId: created.data.user.id, tempPassword: password, error: null };
  }
  // Already registered — find them and reset the password so the invite still works.
  const list = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.data?.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!existing) {
    return { userId: null, tempPassword: null, error: created.error?.message ?? "user_create_failed" };
  }
  const reset = await db.auth.admin.updateUserById(existing.id, { password });
  return {
    userId: existing.id,
    tempPassword: reset.error ? null : password,
    error: null,
  };
}

/** Finds the track for a role, creating an AI-drafted one when needed. */
export async function createTrackForRole(
  orgId: string,
  role: string,
  department: string,
  createdBy: string | null,
  forceNew: boolean,
): Promise<{ trackId: string; title: string; ai: boolean; reused: boolean }> {
  const db = await admin();
  const key = roleKey(role);

  if (!forceNew) {
    const { data: existing } = await db
      .from("module_tracks")
      .select("id, title")
      .eq("org_id", orgId)
      .eq("role_key", key)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { count } = await db
        .from("module_items")
        .select("id", { count: "exact", head: true })
        .eq("track_id", existing.id as string);
      if ((count ?? 0) > 0) {
        return {
          trackId: existing.id as string,
          title: existing.title as string,
          ai: false,
          reused: true,
        };
      }
    }
  }

  const draft = await draftTrack(role, department);
  const { data: track, error } = await db
    .from("module_tracks")
    .insert({
      org_id: orgId,
      title: draft.title,
      role_key: key,
      summary: draft.summary,
      source: draft.ai ? "ai" : "manual",
      created_by: createdBy,
    })
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);

  const rows = draft.items.map((item, index) => ({
    org_id: orgId,
    track_id: track.id as string,
    position: index,
    title: item.title,
    content: item.content,
    duration_minutes: item.duration_minutes,
  }));
  const { error: itemsError } = await db.from("module_items").insert(rows);
  if (itemsError) throw new Error(itemsError.message);

  return { trackId: track.id as string, title: track.title as string, ai: draft.ai, reused: false };
}

async function buildAssessment(
  orgId: string,
  candidateId: string,
  trackId: string,
  role: string,
): Promise<{ assessmentId: string; ai: boolean }> {
  const db = await admin();
  const { data: items } = await db
    .from("module_items")
    .select("title, content, duration_minutes")
    .eq("track_id", trackId)
    .order("position", { ascending: true });

  const { questions, ai } = await draftQuestions(
    role,
    (items ?? []).map((i) => ({
      title: i.title as string,
      content: i.content as string,
      duration_minutes: (i.duration_minutes as number) ?? 20,
    })),
  );

  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
  const { data: assessment, error } = await db
    .from("candidate_assessments")
    .insert({
      org_id: orgId,
      candidate_id: candidateId,
      track_id: trackId,
      status: "not_started",
      max_score: maxScore,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: qError } = await db.from("assessment_questions").insert(
    questions.map((q, index) => ({
      org_id: orgId,
      assessment_id: assessment.id as string,
      position: index,
      kind: q.kind,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      points: q.points,
    })),
  );
  if (qError) throw new Error(qError.message);

  return { assessmentId: assessment.id as string, ai };
}

export async function onboardCandidate(input: {
  orgId: string;
  appOrigin: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  notes: string | null;
  createdBy: string;
}) {
  const db = await admin();

  const account = await ensureAuthUser(input.email, input.fullName);
  const track = await createTrackForRole(
    input.orgId,
    input.role,
    input.department,
    input.createdBy,
    false,
  );

  const { data: candidate, error } = await db
    .from("candidates")
    .upsert(
      {
        org_id: input.orgId,
        full_name: input.fullName,
        email: input.email,
        role: input.role,
        department: input.department,
        notes: input.notes,
        track_id: track.trackId,
        user_id: account.userId,
        stage: "invited",
        created_by: input.createdBy,
      },
      { onConflict: "org_id,email" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const candidateId = candidate.id as string;

  const { data: hasAssessment } = await db
    .from("candidate_assessments")
    .select("id")
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (!hasAssessment) {
    await buildAssessment(input.orgId, candidateId, track.trackId, input.role);
  }

  const portalUrl = `${input.appOrigin.replace(/\/$/, "")}/portal`;
  const mail = inviteEmail({
    fullName: input.fullName,
    role: input.role,
    email: input.email,
    tempPassword: account.tempPassword,
    portalUrl,
    trackTitle: track.title,
  });
  const sent = account.userId
    ? await sendCandidateMail(input.orgId, input.email, mail.subject, mail.html)
    : { ok: false, error: account.error ?? "account_failed" };

  await db
    .from("candidates")
    .update({
      invite_sent_at: sent.ok ? new Date().toISOString() : null,
      invite_error: sent.ok ? null : sent.error,
    })
    .eq("id", candidateId);

  await logActivity({
    orgId: input.orgId,
    tool: "keystone",
    action: "candidate_invited",
    outcome: sent.ok ? "ok" : "failed",
    detail: sent.ok
      ? `${input.fullName} invited to "${track.title}"`
      : `Invite email failed for ${input.email}: ${sent.error}`,
  });

  return {
    candidateId,
    trackTitle: track.title,
    trackReused: track.reused,
    accountCreated: Boolean(account.userId),
    inviteSent: sent.ok,
    error: sent.ok ? null : sent.error,
  };
}

export async function resendInvite(orgId: string, candidateId: string, appOrigin: string) {
  const db = await admin();
  const { data: candidate, error } = await db
    .from("candidates")
    .select("id, full_name, email, role, track_id")
    .eq("org_id", orgId)
    .eq("id", candidateId)
    .single();
  if (error) throw new Error(error.message);

  const account = await ensureAuthUser(candidate.email as string, candidate.full_name as string);
  if (account.userId) {
    await db.from("candidates").update({ user_id: account.userId }).eq("id", candidateId);
  }

  const { data: track } = candidate.track_id
    ? await db
        .from("module_tracks")
        .select("title")
        .eq("id", candidate.track_id as string)
        .maybeSingle()
    : { data: null };

  const mail = inviteEmail({
    fullName: candidate.full_name as string,
    role: candidate.role as string,
    email: candidate.email as string,
    tempPassword: account.tempPassword,
    portalUrl: `${appOrigin.replace(/\/$/, "")}/portal`,
    trackTitle: (track?.title as string | undefined) ?? "Your onboarding modules",
  });
  const sent = await sendCandidateMail(
    orgId,
    candidate.email as string,
    mail.subject,
    mail.html,
  );
  await db
    .from("candidates")
    .update({
      invite_sent_at: sent.ok ? new Date().toISOString() : null,
      invite_error: sent.ok ? null : sent.error,
    })
    .eq("id", candidateId);
  return { ok: sent.ok, error: sent.error };
}

export type PortalQuestion = {
  id: string;
  kind: "mcq" | "written";
  prompt: string;
  options: string[];
  points: number;
};

export type CandidateSpace = {
  candidate: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    department: string;
    stage: string;
  } | null;
  track: { id: string; title: string; summary: string | null } | null;
  items: { id: string; title: string; content: string; duration_minutes: number; done: boolean }[];
  assessment: {
    id: string;
    status: string;
    score: number | null;
    max_score: number | null;
    ai_feedback: string | null;
    submitted_at: string | null;
  } | null;
  questions: PortalQuestion[];
  results: { question_id: string; correct: boolean | null; ai_score: number | null; ai_feedback: string | null; answer_text: string | null; choice_index: number | null }[];
};

export async function loadCandidateSpace(userId: string): Promise<CandidateSpace> {
  const db = await admin();
  const { data: candidate } = await db
    .from("candidates")
    .select("id, full_name, email, role, department, stage, track_id, org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!candidate) {
    return { candidate: null, track: null, items: [], assessment: null, questions: [], results: [] };
  }

  const [trackRes, itemsRes, progressRes, assessmentRes] = await Promise.all([
    candidate.track_id
      ? db
          .from("module_tracks")
          .select("id, title, summary")
          .eq("id", candidate.track_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    candidate.track_id
      ? db
          .from("module_items")
          .select("id, title, content, duration_minutes")
          .eq("track_id", candidate.track_id as string)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
    db
      .from("candidate_module_progress")
      .select("module_item_id, status")
      .eq("candidate_id", candidate.id as string),
    db
      .from("candidate_assessments")
      .select("id, status, score, max_score, ai_feedback, submitted_at")
      .eq("candidate_id", candidate.id as string)
      .maybeSingle(),
  ]);

  const done = new Set(
    (progressRes.data ?? [])
      .filter((p) => p.status === "completed")
      .map((p) => p.module_item_id as string),
  );

  const assessment = assessmentRes.data as CandidateSpace["assessment"];
  let questions: PortalQuestion[] = [];
  let results: CandidateSpace["results"] = [];
  if (assessment) {
    const [qRes, aRes] = await Promise.all([
      db
        .from("assessment_questions")
        .select("id, kind, prompt, options, points")
        .eq("assessment_id", assessment.id)
        .order("position", { ascending: true }),
      db
        .from("assessment_answers")
        .select("question_id, correct, ai_score, ai_feedback, answer_text, choice_index")
        .eq("assessment_id", assessment.id),
    ]);
    questions = (qRes.data ?? []).map((q) => ({
      id: q.id as string,
      kind: (q.kind as string) === "written" ? "written" : "mcq",
      prompt: q.prompt as string,
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      points: (q.points as number) ?? 1,
    }));
    results = (aRes.data ?? []) as CandidateSpace["results"];
  }

  return {
    candidate: {
      id: candidate.id as string,
      full_name: candidate.full_name as string,
      email: candidate.email as string,
      role: candidate.role as string,
      department: candidate.department as string,
      stage: candidate.stage as string,
    },
    track: (trackRes.data as CandidateSpace["track"]) ?? null,
    items: (itemsRes.data ?? []).map((i) => ({
      id: i.id as string,
      title: i.title as string,
      content: i.content as string,
      duration_minutes: (i.duration_minutes as number) ?? 20,
      done: done.has(i.id as string),
    })),
    assessment,
    questions,
    results,
  };
}

export async function markProgress(userId: string, moduleItemId: string, done: boolean) {
  const db = await admin();
  const { data: candidate } = await db
    .from("candidates")
    .select("id, org_id, track_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!candidate) throw new Error("No candidate profile for this account.");

  const { data: item } = await db
    .from("module_items")
    .select("id")
    .eq("id", moduleItemId)
    .eq("track_id", candidate.track_id as string)
    .maybeSingle();
  if (!item) throw new Error("That module is not assigned to you.");

  const { error } = await db.from("candidate_module_progress").upsert(
    {
      org_id: candidate.org_id as string,
      candidate_id: candidate.id as string,
      module_item_id: moduleItemId,
      status: done ? "completed" : "not_started",
      completed_at: done ? new Date().toISOString() : null,
    },
    { onConflict: "candidate_id,module_item_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true, done };
}

export async function gradeSubmission(
  userId: string,
  answers: { questionId: string; choiceIndex?: number | null; text?: string }[],
) {
  const db = await admin();
  const { data: candidate } = await db
    .from("candidates")
    .select("id, org_id, role, full_name, track_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!candidate) throw new Error("No candidate profile for this account.");

  const { data: assessment } = await db
    .from("candidate_assessments")
    .select("id, status, max_score")
    .eq("candidate_id", candidate.id as string)
    .maybeSingle();
  if (!assessment) throw new Error("No assessment has been prepared for you yet.");
  if (assessment.status === "graded") throw new Error("Your assessment has already been submitted.");

  // Gate: every module must be complete first.
  const [{ data: items }, { data: progress }] = await Promise.all([
    db.from("module_items").select("id").eq("track_id", candidate.track_id as string),
    db
      .from("candidate_module_progress")
      .select("module_item_id, status")
      .eq("candidate_id", candidate.id as string),
  ]);
  const completed = new Set(
    (progress ?? []).filter((p) => p.status === "completed").map((p) => p.module_item_id as string),
  );
  const remaining = (items ?? []).filter((i) => !completed.has(i.id as string)).length;
  if (remaining > 0) throw new Error(`Finish all modules first — ${remaining} left.`);

  const { data: questions } = await db
    .from("assessment_questions")
    .select("id, kind, prompt, options, correct_index, points")
    .eq("assessment_id", assessment.id as string)
    .order("position", { ascending: true });

  const given = new Map(answers.map((a) => [a.questionId, a]));
  let score = 0;
  const rows: Record<string, unknown>[] = [];
  const written: { id: string; prompt: string; answer: string; points: number }[] = [];

  for (const q of questions ?? []) {
    const id = q.id as string;
    const answer = given.get(id);
    if ((q.kind as string) === "mcq") {
      const choice = answer?.choiceIndex ?? null;
      const correct = choice !== null && choice === (q.correct_index as number | null);
      if (correct) score += (q.points as number) ?? 1;
      rows.push({
        org_id: candidate.org_id,
        assessment_id: assessment.id,
        question_id: id,
        choice_index: choice,
        correct,
      });
    } else {
      const text = (answer?.text ?? "").trim();
      written.push({
        id,
        prompt: q.prompt as string,
        answer: text,
        points: (q.points as number) ?? 5,
      });
      rows.push({
        org_id: candidate.org_id,
        assessment_id: assessment.id,
        question_id: id,
        answer_text: text,
      });
    }
  }

  const graded = await gradeWritten(candidate.role as string, written);
  for (const row of rows) {
    const id = row["question_id"] as string;
    const g = graded.scores[id];
    if (g) {
      row["ai_score"] = g.score;
      row["ai_feedback"] = g.feedback;
      score += g.score;
    }
  }

  const { error: answersError } = await db
    .from("assessment_answers")
    .upsert(rows, { onConflict: "question_id" });
  if (answersError) throw new Error(answersError.message);

  const maxScore =
    (assessment.max_score as number | null) ??
    (questions ?? []).reduce((sum, q) => sum + (((q.points as number) ?? 1) as number), 0);
  const rounded = Math.round(score);

  await db
    .from("candidate_assessments")
    .update({
      status: "graded",
      score: rounded,
      max_score: maxScore,
      ai_feedback: graded.summary || null,
      submitted_at: new Date().toISOString(),
      graded_at: new Date().toISOString(),
    })
    .eq("id", assessment.id as string);

  await db
    .from("candidates")
    .update({ stage: "assessed" })
    .eq("id", candidate.id as string);

  await logActivity({
    orgId: candidate.org_id as string,
    tool: "keystone",
    action: "assessment_graded",
    outcome: "ok",
    detail: `${candidate.full_name as string} scored ${rounded}/${maxScore}`,
  });

  return { score: rounded, maxScore, summary: graded.summary };
}
