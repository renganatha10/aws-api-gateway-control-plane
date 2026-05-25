import { X } from "lucide-react"

import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { MappingEntry, SyncedApi } from "./types"

interface MappingRowProps {
  entry: MappingEntry
  apis: SyncedApi[]
  canRemove: boolean
  onUpdate: (key: number, field: keyof Omit<MappingEntry, "key">, value: string) => void
  onRemove: (key: number) => void
}

export function MappingRow({ entry, apis, canRemove, onUpdate, onRemove }: MappingRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={entry.apiId} onValueChange={(v) => onUpdate(entry.key, "apiId", v)}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Select API…" />
        </SelectTrigger>
        <SelectContent>
          {apis.length === 0 ? (
            <SelectItem value="_none" disabled>No AWS-synced APIs found</SelectItem>
          ) : (
            apis.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.displayName}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Input
        value={entry.stage}
        onChange={(e) => onUpdate(entry.key, "stage", e.target.value)}
        placeholder="stage (e.g. prod)"
        className="w-36"
      />

      <Input
        value={entry.basePath}
        onChange={(e) => onUpdate(entry.key, "basePath", e.target.value)}
        placeholder="base path (optional)"
        className="w-44"
      />

      <button
        type="button"
        onClick={() => onRemove(entry.key)}
        disabled={!canRemove}
        className="text-gray-400 hover:text-red-600 disabled:opacity-30 transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
