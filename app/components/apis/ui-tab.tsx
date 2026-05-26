import { useMemo } from "react";

import { DefinitionsSection } from "./definitions-section";
import { EndpointCard } from "./endpoint-card";
import { parseSpec } from "./parse-spec";

export function UiTab({ yamlValue }: { yamlValue: string }) {
  const { groups, spec } = useMemo(() => parseSpec(yamlValue), [yamlValue]);

  const definitions = Object.entries(spec.definitions ?? spec.components?.schemas ?? {});

  if (groups.length === 0 && definitions.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-zinc-600 text-sm">
        No endpoints found in spec
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
      {groups.map((group) => (
        <div key={group.tag}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-white">{group.tag}</h2>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-600 shrink-0">
              {group.endpoints.length} endpoint{group.endpoints.length !== 1 ? "s" : ""}
            </span>
          </div>
          {group.description && <p className="text-xs text-zinc-500 mb-3">{group.description}</p>}
          <div className="space-y-2">
            {group.endpoints.map((ep, i) => (
              <EndpointCard key={i} ep={ep} />
            ))}
          </div>
        </div>
      ))}

      <DefinitionsSection definitions={definitions} spec={spec} />
    </div>
  );
}
