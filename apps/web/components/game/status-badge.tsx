import { Badge } from "@/components/ui/badge";
import type { GameStatus } from "@/lib/api";

const LABELS: Record<GameStatus, string> = {
  WAITING: "Waiting",
  ACTIVE: "Live",
  PAUSED: "Paused",
  FINISHED: "Finished",
};

export function StatusBadge({ status }: { status: GameStatus }) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
      {LABELS[status]}
    </Badge>
  );
}
