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
import { createHire } from "@/lib/hires.functions";

export function NewHireDialog({ orgId }: { orgId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const queryClient = useQueryClient();
  const run = useServerFn(createHire);

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
          startDate,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`${fullName} added`, {
        description: result.channels.length
          ? `Slack access granted: #${result.channels.join(", #")}`
          : (result.accessError ?? result.channelError ?? "Slack access is still pending."),
      });
      if (result.accessError || result.channelError) {
        toast.error(result.accessError ?? result.channelError ?? "");
      }
      if (result.flowOk) toast.success("Automation flow triggered");
      else if (result.flowError) toast.error(`Flow not triggered: ${result.flowError}`);
      setFullName("");
      setRole("");
      setEmail("");
      setDepartment("");
      setStartDate("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["hires"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not add the hire");
    },
  });

  const ready = fullName.trim() && role.trim() && /.+@.+\..+/.test(email);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!orgId}>
          Add new hire
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new hire</DialogTitle>
          <DialogDescription>
            Creates the hire, opens their onboarding channel, and gives them access to #general in
            this organization&apos;s Slack workspace.
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
            <Label htmlFor="hire-name">Full name</Label>
            <Input
              id="hire-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Priya Sharma"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hire-role">Role</Label>
            <Input
              id="hire-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Backend Engineer"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hire-email">Work email</Label>
            <Input
              id="hire-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@company.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Used to find them in Slack, so it should match their Slack account email.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hire-dept">Department</Label>
              <Input
                id="hire-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hire-start">Start date</Label>
              <Input
                id="hire-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!ready || mutation.isPending}>
              {mutation.isPending ? "Provisioning…" : "Create and grant access"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
