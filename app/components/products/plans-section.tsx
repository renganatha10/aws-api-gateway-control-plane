import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { PlanItem } from "./types";

interface PlansSectionProps {
  displayedPlans: PlanItem[];
  availablePlans: PlanItem[];
  dropdownPlanId: string;
  onDropdownChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
}

export function PlansSection({
  displayedPlans,
  availablePlans,
  dropdownPlanId,
  onDropdownChange,
  onAdd,
  onRemove,
}: PlansSectionProps) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-base font-medium text-amber-600">Plans</h2>
        <Separator className="mt-2" />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={dropdownPlanId}
          onValueChange={onDropdownChange}
          disabled={availablePlans.length === 0}
        >
          <SelectTrigger className="flex-1 max-w-xs">
            <SelectValue
              placeholder={availablePlans.length === 0 ? "All plans added" : "Select a plan…"}
            />
          </SelectTrigger>
          <SelectContent>
            {availablePlans.map((plan) => (
              <SelectItem key={plan.id} value={String(plan.id)}>
                {plan.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" disabled={!dropdownPlanId} onClick={onAdd}>
          Add
        </Button>
      </div>

      {displayedPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <svg
            aria-hidden="true"
            className="size-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
          </svg>
          <p className="text-sm font-medium text-gray-600">No plans added yet</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-700">Display Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Throttle</TableHead>
                <TableHead className="font-semibold text-gray-700">Burst</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPlans.map((plan) => (
                <TableRow key={plan.id} className="group">
                  <TableCell className="font-medium text-gray-900">{plan.displayName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {plan.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {plan.throttle != null ? `${plan.throttle} req/s` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {plan.burst != null ? `${plan.burst} req/s` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(plan.id)}
                      className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove plan"
                    >
                      <svg
                        aria-hidden="true"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
