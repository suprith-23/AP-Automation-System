/**
 * StatusBadge — legacy compatibility wrapper over the new StatusPill primitive.
 * Kept for backward compatibility with older components that import this.
 * New code should import StatusPill from "@/components/ui/StatusPill" directly.
 */
import StatusPill from "./ui/StatusPill";

type Props = {
  status?: string;
};

export default function StatusBadge({ status }: Props) {
  return <StatusPill status={status} />;
}
