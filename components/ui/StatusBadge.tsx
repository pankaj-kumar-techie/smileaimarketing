export type StatusLevel = "healthy" | "opportunity" | "attention";

/** Single source of truth for what counts as healthy/opportunity/attention across the site. */
export function statusFromScore(score: number): StatusLevel {
  if (score >= 70) return "healthy";
  if (score >= 50) return "opportunity";
  return "attention";
}

const STATUS_LABEL: Record<StatusLevel, string> = {
  healthy: "Healthy",
  opportunity: "Opportunity",
  attention: "Needs Attention",
};

const STATUS_CLASS: Record<StatusLevel, string> = {
  healthy: "badge-healthy",
  opportunity: "badge-opportunity",
  attention: "badge-attention",
};

type StatusBadgeProps = {
  status: StatusLevel;
  label?: string;
  className?: string;
};

export default function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-metadata font-semibold ${STATUS_CLASS[status]} ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
