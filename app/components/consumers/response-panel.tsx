import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { StatusBadge } from "./status-badge"
import type { ProxyResponse } from "./tryout-types"

export function ResponsePanel({ data }: { data: ProxyResponse }) {
  const [headersOpen, setHeadersOpen] = useState(false)

  let prettyBody = data.resBody
  const contentType = data.resHeaders["content-type"] ?? ""
  if (contentType.includes("json")) {
    try {
      prettyBody = JSON.stringify(JSON.parse(data.resBody), null, 2)
    } catch {
      /* keep raw */
    }
  }

  const bodyBg =
    data.httpStatus >= 200 && data.httpStatus < 300 ? "bg-green-50 border-green-200" :
    data.httpStatus >= 400 && data.httpStatus < 500 ? "bg-orange-50 border-orange-200" :
    data.httpStatus >= 500                          ? "bg-red-50 border-red-200"       :
                                                     "bg-gray-50 border-gray-200"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <StatusBadge status={data.httpStatus} />
        <span className="text-sm text-gray-500">{data.statusText}</span>
        <span className="text-xs text-gray-400 ml-auto">{data.ms}ms</span>
      </div>

      <div>
        <button
          onClick={() => setHeadersOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-1"
        >
          {headersOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          Response headers ({Object.keys(data.resHeaders).length})
        </button>
        {headersOpen && (
          <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-1 text-xs font-mono">
            {Object.entries(data.resHeaders).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500 shrink-0">{k}:</span>
                <span className="text-gray-800 break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`rounded border p-4 text-xs font-mono whitespace-pre-wrap break-all ${bodyBg}`}>
        {prettyBody || <span className="text-gray-400 italic">Empty response body</span>}
      </div>
    </div>
  )
}
