import { cn } from "@/lib/utils";
import { STATUS_LABEL, type TaskStatus } from "@/lib/dashboard-data";

const STYLES: Record<TaskStatus, string> = {
  completed: "bg-ok/15 text-ok border-ok/30",
  in_progress: "bg-run/15 text-run border-run/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  needs_human: "bg-wait/15 text-wait border-wait/30",
  not_started: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight",
        STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
