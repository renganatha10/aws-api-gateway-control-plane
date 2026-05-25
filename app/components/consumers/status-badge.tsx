export function StatusBadge({ status }: { status: number }) {
  let cls = ""
  if (status >= 200 && status < 300)      cls = "bg-green-50 text-green-700 border-green-300"
  else if (status >= 300 && status < 400) cls = "bg-yellow-50 text-yellow-700 border-yellow-300"
  else if (status >= 400 && status < 500) cls = "bg-orange-50 text-orange-700 border-orange-300"
  else                                    cls = "bg-red-50 text-red-700 border-red-300"

  const dotCls =
    status < 300 ? "bg-green-500" :
    status < 400 ? "bg-yellow-500" :
    status < 500 ? "bg-orange-500" : "bg-red-500"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-sm font-semibold ${cls}`}
    >
      <span className={`size-2 rounded-full ${dotCls}`} />
      {status}
    </span>
  )
}
