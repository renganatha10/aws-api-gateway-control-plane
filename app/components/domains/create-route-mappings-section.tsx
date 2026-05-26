import { Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { MappingRow } from "./mapping-row";
import type { MappingEntry, SyncedApi } from "./types";

interface CreateRouteMappingsSectionProps {
  entries: MappingEntry[];
  apis: SyncedApi[];
  onAdd: () => void;
  onUpdate: (key: number, field: keyof Omit<MappingEntry, "key">, value: string) => void;
  onRemove: (key: number) => void;
}

export function CreateRouteMappingsSection({
  entries,
  apis,
  onAdd,
  onUpdate,
  onRemove,
}: CreateRouteMappingsSectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Route Mappings</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Map this domain to an API + stage. Leave base path empty to serve the API at the domain
          root (stored as <code className="bg-gray-100 px-1 rounded text-[11px]">(none)</code>).
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-52">API</span>
        <span className="w-36">Stage</span>
        <span className="w-44">Base Path</span>
      </div>

      <div className="space-y-2">
        {entries.map((m) => (
          <MappingRow
            key={m.key}
            entry={m}
            apis={apis}
            canRemove={entries.length > 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus className="size-3.5 mr-1.5" />
        Add Mapping
      </Button>
    </div>
  );
}
