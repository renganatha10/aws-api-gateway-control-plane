import { Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { CreateEnvironmentDialog } from "./create-environment-dialog";

interface Environment {
  id: number;
  name: string;
  createdBy: string;
  createdAt: Date | string;
}

interface EnvironmentsPageProps {
  environments: Environment[];
  organisationId: number | null;
}

export function EnvironmentsPage({ environments, organisationId }: EnvironmentsPageProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-3xl font-normal text-gray-900">Environments</h1>
        <Button size="sm" disabled={!organisationId} onClick={() => setOpen(true)}>
          Add
        </Button>
      </div>

      {!organisationId && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <Zap className="size-10 text-gray-300" />
          <p className="text-gray-500 text-sm">
            Select an Organisation from the sidebar to view its environments.
          </p>
        </div>
      )}

      {organisationId && environments.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 mt-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <Zap className="size-10 text-gray-300" />
          <div>
            <p className="text-sm font-medium text-gray-600">No environments yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="underline underline-offset-2 hover:text-gray-700"
              >
                Create your first environment
              </button>
            </p>
          </div>
        </div>
      )}

      {organisationId && environments.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead className="w-[35%] font-semibold text-gray-700">Name</TableHead>
              <TableHead className="w-[35%] font-semibold text-gray-700">Created By</TableHead>
              <TableHead className="font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  Created
                  <svg
                    aria-hidden="true"
                    className="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {environments.map((env) => (
              <TableRow key={env.id} className="border-b border-gray-200">
                <TableCell className="text-gray-900">{env.name}</TableCell>
                <TableCell className="text-gray-700">{env.createdBy}</TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(env.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateEnvironmentDialog open={open} organisationId={organisationId} onOpenChange={setOpen} />
    </div>
  );
}
