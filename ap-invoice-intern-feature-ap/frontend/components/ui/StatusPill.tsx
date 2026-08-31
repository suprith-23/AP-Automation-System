"use client";

export type StatusVariant =
  | "approved" | "matched" | "passed" | "validated" | "paid" | "completed" | "active" | "production" | "healthy" | "online"
  | "rejected" | "failed" | "validation_failed" | "closed" | "mismatch" | "overdue" | "offline" | "revoked" | "inactive"
  | "pending" | "pending_review" | "review_pending" | "in_review" | "pending_approval" | "draft" | "staging" | "degraded" | "development"
  | "uploaded" | "processing" | "open" | "info"
  | "exception" | "duplicate"
  | (string & {});

type Config = { bg: string; text: string; dot: string; label: string };

const STATUS_MAP: Record<string, Config> = {
  // Green
  approved:         { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Approved"          },
  matched:          { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Matched"            },
  passed:           { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Passed"             },
  validated:        { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Validated"          },
  paid:             { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Paid"               },
  completed:        { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Completed"          },
  active:           { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Active"             },
  production:       { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Production"         },
  healthy:          { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Healthy"            },
  online:           { bg: "bg-fw-green dark:bg-fw-green-deep", text: "text-fw-green-deep dark:text-fw-green-dark", dot: "bg-current", label: "Online"             },

  // Red
  rejected:         { bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Rejected"           },
  failed:           { bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Failed"             },
  closed:           { bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Closed"             },
  overdue:          { bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Overdue"            },
  offline:          { bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Offline"            },
  revoked:          { bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Revoked"            },
  inactive:         { bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Inactive"           },

  // Blue (Exceptions)
  exception:        { bg: "bg-fw-blue dark:bg-fw-blue-deep", text: "text-white dark:text-fw-blue-dark", dot: "bg-current", label: "Exception"          },
  mismatch:         { bg: "bg-fw-blue dark:bg-fw-blue-deep", text: "text-white dark:text-fw-blue-dark", dot: "bg-current", label: "Mismatch"           },
  duplicate:        { bg: "bg-fw-blue dark:bg-fw-blue-deep", text: "text-white dark:text-fw-blue-dark", dot: "bg-current", label: "Duplicate"          },
  validation_failed:{ bg: "bg-fw-red dark:bg-fw-red-deep", text: "text-white dark:text-fw-red-dark", dot: "bg-current", label: "Validation Failed"  },

  // Amber/Yellow
  pending:          { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Pending"            },
  pending_review:   { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Pending Review"     },
  review_pending:   { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Review Pending"     },
  in_review:        { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "In Review"          },
  pending_approval: { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Pending Approval"   },
  draft:            { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Draft"              },
  staging:          { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Staging"            },
  degraded:         { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Degraded"           },
  development:      { bg: "bg-fw-amber dark:bg-fw-amber-deep", text: "text-fw-amber-deep dark:text-fw-amber-dark", dot: "bg-current", label: "Development"        },

  // Teal/Cyan
  uploaded:         { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "Uploaded"           },
  queued:           { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "Queued"             },
  ocr_running:      { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "OCR Running"        },
  extracting:       { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "Extracting"         },
  validating:       { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "Validating"         },
  processing:       { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "Processing"         },
  open:             { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "Open"               },
  info:             { bg: "bg-fw-teal dark:bg-fw-teal-deep", text: "text-fw-teal-deep dark:text-fw-teal-dark", dot: "bg-current", label: "Info"               },
};

const FALLBACK: Config = {
  bg:    "bg-zinc-100 dark:bg-zinc-800",
  text:  "text-zinc-600 dark:text-zinc-300",
  dot:   "bg-zinc-400",
  label: "",
};

type Props = {
  status?: string;
  /** Override the display label */
  label?: string;
  className?: string;
};

/**
 * StatusPill — universal status indicator.
 * Always renders a filled pill with a coloured dot + text label.
 * Never dot-only. Never colour-only.
 */
export default function StatusPill({ status, label, className = "" }: Props) {
  const key = (status || "").toLowerCase().trim().replace(/\s+/g, "_");
  const cfg = STATUS_MAP[key] ?? FALLBACK;
  const displayLabel = label ?? (cfg.label || status || "Unknown");

  return (
    <span
      className={`status-pill fw-texture-grain ${cfg.bg} ${cfg.text} ${className}`}
      aria-label={`Status: ${displayLabel}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} aria-hidden />
      {displayLabel}
    </span>
  );
}
