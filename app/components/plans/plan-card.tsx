import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import type { Plan } from "~/lib/schema";
import { DeletePlanDialog } from "./delete-plan-dialog";
import { QUOTA_LABEL, type QuotaPeriod } from "./types";

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
}

export function PlanCard({ plan, onEdit }: PlanCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <div className="group relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(plan)}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"
              aria-label="Edit plan"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
              aria-label="Delete plan"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          {plan.throttle != null && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Throttle</dt>
              <dd>
                <Badge variant="secondary" className="font-mono text-xs">
                  {plan.throttle}/sec
                </Badge>
              </dd>
            </div>
          )}
          {plan.burst != null && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Burst</dt>
              <dd>
                <Badge variant="outline" className="font-mono text-xs">
                  {plan.burst}/sec
                </Badge>
              </dd>
            </div>
          )}
          {plan.quotaLimit != null && plan.quotaPeriod && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Quota</dt>
              <dd>
                <Badge variant="outline" className="font-mono text-xs">
                  {plan.quotaLimit.toLocaleString()}/{QUOTA_LABEL[plan.quotaPeriod as QuotaPeriod]}
                </Badge>
              </dd>
            </div>
          )}
          {plan.throttle == null && plan.burst == null && plan.quotaLimit == null && (
            <p className="text-xs text-muted-foreground italic">No limits configured</p>
          )}
        </dl>
      </div>

      <DeletePlanDialog plan={plan} open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </>
  );
}
