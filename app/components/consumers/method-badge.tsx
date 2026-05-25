const METHOD_COLORS: Record<string, string> = {
  get:     "bg-blue-50 text-blue-700 border-blue-200",
  post:    "bg-green-50 text-green-700 border-green-200",
  put:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  patch:   "bg-orange-50 text-orange-700 border-orange-200",
  delete:  "bg-red-50 text-red-700 border-red-200",
  head:    "bg-purple-50 text-purple-700 border-purple-200",
  options: "bg-gray-50 text-gray-700 border-gray-200",
}

export function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_COLORS[method.toLowerCase()] ?? "bg-gray-50 text-gray-700 border-gray-200"
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold uppercase ${cls}`}
    >
      {method.toUpperCase()}
    </span>
  )
}
