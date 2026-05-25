import { Label } from "~/components/ui/label"

const API_TYPES = [
  { value: "swagger2", label: "Swagger 2.0" },
  { value: "openapi3", label: "OpenAPI 3.0" },
]

interface ApiTypeSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function ApiTypeSelector({ value, onChange }: ApiTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Type</Label>
      <input type="hidden" name="type" value={value} />
      <div className="flex gap-2">
        {API_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={[
              "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              value === t.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
