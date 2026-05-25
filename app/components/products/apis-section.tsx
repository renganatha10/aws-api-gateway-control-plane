import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { SPEC_TYPE_LABEL, type ApiItem } from "./types"

interface ApisSectionProps {
  displayedApis: ApiItem[]
  availableApis: ApiItem[]
  dropdownApiId: string
  onDropdownChange: (value: string) => void
  onAdd: () => void
  onRemove: (id: number) => void
}

export function ApisSection({
  displayedApis,
  availableApis,
  dropdownApiId,
  onDropdownChange,
  onAdd,
  onRemove,
}: ApisSectionProps) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-base font-medium text-amber-600">APIs</h2>
        <Separator className="mt-2" />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={dropdownApiId}
          onValueChange={onDropdownChange}
          disabled={availableApis.length === 0}
        >
          <SelectTrigger className="flex-1 max-w-xs">
            <SelectValue
              placeholder={availableApis.length === 0 ? "All APIs added" : "Select an API…"}
            />
          </SelectTrigger>
          <SelectContent>
            {availableApis.map((api) => (
              <SelectItem key={api.id} value={String(api.id)}>
                {api.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" disabled={!dropdownApiId} onClick={onAdd}>
          Add
        </Button>
      </div>

      {displayedApis.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <svg
            className="size-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" />
          </svg>
          <p className="text-sm font-medium text-gray-600">No APIs added yet</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-700">Display Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Base Path</TableHead>
                <TableHead className="font-semibold text-gray-700">Type</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedApis.map((api) => (
                <TableRow key={api.id} className="group">
                  <TableCell className="font-medium text-gray-900">{api.displayName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {api.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {api.basePath ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {SPEC_TYPE_LABEL[api.specType] ?? api.specType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(api.id)}
                      className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove API"
                    >
                      <svg
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
  )
}
