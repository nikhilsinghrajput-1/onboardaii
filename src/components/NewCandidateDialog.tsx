import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCandidate } from "@/lib/modules.functions";

export function NewCandidateDialog({ orgId }: { orgId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const run = useServerFn(createCandidate);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No active organization");
      return run({
        data: {
          orgId,
          appOrigin: window.location.origin,
          fullName,
          role,
          email,
          department,
          notes,
        },
      });
    },
    onSuccess: (result) => {
      if (result.inviteSent) {
        toast.success(`${fullName} invited`, {
          description: `Assigned "${result.trackTitle}" — the invite email is on its way.`,
        });
      } else {
        toast.error("Candidate saved, invite email failed", {
          description: result.error ?? "Check that Gmail or Outlook is connected under Tools.",
        });
      }
      setFullName("");
      setRole("");
      setEmail("");
      setDepartment("");
      setNotes("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["module-tracks"] });
      void queryClient.invalidateQueries({ queryKey: ["candidate-progress"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not add the candidate");
    },
  });

  const ready = fullName.trim() && role.trim() && /.+@.+\..+/.test(email);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!orgId}>
          Add new candidate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new candidate</DialogTitle>
          <DialogDescription>
            Keystone creates their account, assigns the module track for the role they applied for
            (drafting one with AI if it does not exist yet), prepares the assessment and emails the
            invite.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready && !mutation.isPending) mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cand-name">Full name</Label>
            <Input
              id="cand-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Priya Sharma"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cand-role">Applying for</Label>
            <Input
              id="cand-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Backend Engineer"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cand-email">Email</Label>
            <Input
              id="cand-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@example.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Their Keystone login is created with this address.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cand-dept">Department</Label>
            <Input
              id="cand-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Engineering"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cand-notes">Notes (optional)</Label>
            <Textarea
              id="cand-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referral, interview context, anything the team should know."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!ready || mutation.isPending}>
              {mutation.isPending ? "Setting up…" : "Create & invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
