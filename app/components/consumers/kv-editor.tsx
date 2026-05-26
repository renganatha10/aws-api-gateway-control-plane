import { Plus, Trash2 } from "lucide-react";

import { Input } from "~/components/ui/input";
import type { KVRow } from "./tryout-types";

interface KVEditorProps {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KVEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: KVEditorProps) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={row.key}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], key: e.target.value };
                onChange(next);
              }}
              placeholder={keyPlaceholder}
              className="h-8 text-sm font-mono"
            />
            <Input
              value={row.value}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], value: e.target.value };
                onChange(next);
              }}
              placeholder={valuePlaceholder}
              className="h-8 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, { key: "", value: "" }])}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Plus className="size-3.5" />
        Add row
      </button>
    </div>
  );
}
