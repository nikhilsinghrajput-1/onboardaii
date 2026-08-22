import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { addMember, membersQuery, removeMember, setMemberRole } from "@/lib/orgs";

export function MembersCard({ orgId, canManage }: { orgId: string | undefined; canManage: boolean }) {
  const members = useQuery(membersQuery);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["organization-members"] });

  const invite = useMutation({
    mutationFn: (value: string) => addMember(orgId!, value, "member"),
    onSuccess: async () => {
      setEmail("");
      toast.success("Added. They get in the next time they sign in.");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not add that person."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSuccess: async () => {
      toast.success("Access removed.");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not remove that person."),
  });

  const promote = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "owner" | "member" }) => setMemberRole(id, role),
    onSuccess: async () => {
      toast.success("Role updated.");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not change that role."),
  });

  const owners = (members.data ?? []).filter((m) => m.role === "owner").length;

  return (
    <section className="mt-12 rounded-xl border border-border/70 bg-card p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Members</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Only these people can sign in to this workspace. Add someone by email before their first
        sign-in and they are let in automatically.
      </p>

      {members.isLoading && <Skeleton className="mt-4 h-20 w-full" />}
      <ul className="mt-4 divide-y divide-border/60">
        {(members.data ?? []).map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <span className="font-mono text-xs break-all">{member.email ?? "unknown email"}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {member.role}
            </span>
            {!member.user_id && (
              <span className="rounded-full border border-wait/40 bg-wait/10 px-2 py-0.5 text-xs text-wait">
                pending first sign-in
              </span>
            )}
            {canManage && (
              <span className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={promote.isPending || (member.role === "owner" && owners <= 1)}
                  onClick={() =>
                    promote.mutate({
                      id: member.id,
                      role: member.role === "owner" ? "member" : "owner",
                    })
                  }
                >
                  {member.role === "owner" ? "Make member" : "Make admin"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={remove.isPending || (member.role === "owner" && owners <= 1)}
                  onClick={() => remove.mutate(member.id)}
                >
                  Remove
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {canManage ? (
        <form
          className="mt-5 flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = email.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              toast.error("Enter a valid email address.");
              return;
            }
            if (!orgId) return;
            invite.mutate(value);
          }}
        >
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@acropolis.in"
            className="max-w-xs"
            aria-label="Member email"
          />
          <Button type="submit" size="sm" disabled={invite.isPending || !orgId}>
            {invite.isPending ? "Adding…" : "Add member"}
          </Button>
        </form>
      ) : (
        <p className="mt-5 text-xs text-muted-foreground">Only admins can change this list.</p>
      )}
    </section>
  );
}
