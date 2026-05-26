import { useMemo } from "react";

import { MethodBadge } from "./method-badge";
import { parseEndpointList } from "./parse-spec";

interface SourceTabProps {
  yamlValue: string;
  setYamlValue: (v: string) => void;
  hosts: Record<string, string>;
  host: string;
}

export function SourceTab({ yamlValue, setYamlValue, hosts, host }: SourceTabProps) {
  const endpoints = useMemo(() => parseEndpointList(yamlValue), [yamlValue]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 border-r border-white/10">
        <div className="px-4 py-2 text-xs text-zinc-500 border-b border-white/10 bg-zinc-950">
          YAML
        </div>
        <textarea
          value={yamlValue}
          onChange={(e) => setYamlValue(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full bg-black text-white font-mono text-xs leading-relaxed px-4 py-4 resize-none focus:outline-none caret-white"
        />
      </div>

      <div className="flex flex-col w-80 shrink-0 overflow-y-auto bg-zinc-950">
        <div className="px-4 py-2 text-xs text-zinc-500 border-b border-white/10 sticky top-0 bg-zinc-950">
          {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
          {host && hosts[host] && (
            <span className="ml-2 text-zinc-700 font-mono text-[11px] truncate">{hosts[host]}</span>
          )}
        </div>
        {endpoints.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-zinc-600 text-xs p-6 text-center">
            No paths found in spec
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {endpoints.map(({ method, path, summary }, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2.5 hover:bg-white/5">
                <MethodBadge method={method} />
                <div className="min-w-0 mt-0.5">
                  <p className="font-mono text-xs text-white/90 truncate">{path}</p>
                  {summary && <p className="text-[11px] text-zinc-500 truncate">{summary}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
