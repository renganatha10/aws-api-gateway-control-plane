export function StatusBadge({ code }: { code: string }) {
  const n   = parseInt(code)
  const cls =
    n < 300 ? "text-green-400 border-green-700" :
    n < 400 ? "text-blue-400 border-blue-700"   :
    n < 500 ? "text-amber-400 border-amber-700"  :
              "text-red-400 border-red-700"

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono font-semibold ${cls}`}
    >
      {code}
    </span>
  )
}
