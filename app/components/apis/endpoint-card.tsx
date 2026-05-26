import { useState } from "react";

import { METHOD_BORDER } from "./constants";
import { MethodBadge } from "./method-badge";
import { StatusBadge } from "./status-badge";
import type { ParsedEndpoint } from "./types";

export function EndpointCard({ ep }: { ep: ParsedEndpoint }) {
  const [open, setOpen] = useState(false);
  const borderCls = METHOD_BORDER[ep.method] ?? "border-zinc-700";

  return (
    <div className={`rounded-md border ${borderCls} bg-zinc-900 overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <MethodBadge method={ep.method} />
        <code className="text-sm font-mono text-white/90 flex-1 truncate">{ep.path}</code>
        <span className="text-sm text-zinc-400 hidden sm:block truncate max-w-xs">
          {ep.summary}
        </span>
        <svg
          aria-hidden="true"
          className={`size-4 text-zinc-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-4">
          {ep.description && <p className="text-sm text-zinc-400">{ep.description}</p>}

          {ep.parameters.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                Parameters
              </p>
              <div className="rounded border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-800 border-b border-white/10">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-1/4">
                        Name
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-16">
                        In
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-20">
                        Type
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ep.parameters.map((p) => (
                      <tr key={`${p.in}-${p.name}`}>
                        <td className="px-3 py-2">
                          <code className="text-xs font-mono text-white/90">{p.name}</code>
                          {p.required && <span className="text-red-400 ml-1 text-xs">*</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                            {p.in}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-zinc-400">{p.type}</td>
                        <td className="px-3 py-2 text-xs text-zinc-500">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ep.bodyType && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                Request body{" "}
                <span className="font-normal normal-case text-zinc-600">({ep.bodyType})</span>
              </p>
              <pre className="rounded border border-white/10 bg-zinc-950 px-3 py-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
                {ep.bodySample ?? "{}"}
              </pre>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Responses
            </p>
            <div className="space-y-1.5">
              {ep.responses.map((r) => (
                <div
                  key={r.code}
                  className="flex items-center gap-3 rounded border border-white/10 bg-zinc-950 px-3 py-2"
                >
                  <StatusBadge code={r.code} />
                  <span className="text-xs text-zinc-400">{r.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
