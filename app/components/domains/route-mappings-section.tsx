import { useFetcher } from "react-router"
import { Plus } from "lucide-react"

import { Button } from "~/components/ui/button"
import { MappingRow } from "./mapping-row"
import type { MappingEntry, SyncedApi } from "./types"

interface RouteMappingsSectionProps {
  entries: MappingEntry[]
  syncedApis: SyncedApi[]
  onAdd: () => void
  onUpdate: (key: number, field: keyof Omit<MappingEntry, "key">, value: string) => void
  onRemove: (key: number) => void
}

export function RouteMappingsSection({
  entries,
  syncedApis,
  onAdd,
  onUpdate,
  onRemove,
}: RouteMappingsSectionProps) {
  const saveFetcher = useFetcher()
  const saveOk    = saveFetcher.data && "ok" in saveFetcher.data
  const saveError = saveFetcher.data && "error" in saveFetcher.data
    ? (saveFetcher.data as { error: string }).error
    : null
  const saveBusy  = saveFetcher.state !== "idle"

  const mappingPayload = JSON.stringify(
    entries.map(({ apiId, stage, basePath }) => ({
      apiId,
      stage,
      basePath: basePath.trim() || "(none)",
    })),
  )

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Route Mappings</h2>
      <p className="text-xs text-muted-foreground">
        Changes are synced to AWS immediately on save. Leave base path empty to serve at the domain
        root.
      </p>

      {saveError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
      )}
      {saveOk && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Mappings saved.</p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-52">API</span>
        <span className="w-36">Stage</span>
        <span className="w-44">Base Path</span>
      </div>

      <div className="space-y-2">
        {entries.map((e) => (
          <MappingRow
            key={e.key}
            entry={e}
            apis={syncedApis}
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

      <div className="pt-2">
        <saveFetcher.Form method="post">
          <input type="hidden" name="_intent"  value="update" />
          <input type="hidden" name="mappings" value={mappingPayload} />
          <Button
            type="submit"
            disabled={saveBusy}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saveBusy ? "Saving…" : "Save Mappings"}
          </Button>
        </saveFetcher.Form>
      </div>
    </div>
  )
}
