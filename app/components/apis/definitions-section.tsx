import { generateSample, schemaType } from "./parse-spec"
import type { RawSchema, RawSpec } from "./types"

interface DefinitionsSectionProps {
  definitions: [string, RawSchema][]
  spec: RawSpec
}

export function DefinitionsSection({ definitions, spec }: DefinitionsSectionProps) {
  if (definitions.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-white">Definitions</h2>
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-zinc-600 shrink-0">
          {definitions.length} model{definitions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {definitions.map(([name, schema]) => {
          const props    = Object.entries(schema.properties ?? {})
          const required = (schema as RawSchema & { required?: string[] }).required ?? []
          let sample = ""
          try { sample = JSON.stringify(generateSample(spec, schema), null, 2) }
          catch { sample = "{}" }

          return (
            <div key={name} className="rounded-md border border-white/10 bg-zinc-900 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-zinc-800">
                <span className="text-sm font-mono font-semibold text-white">{name}</span>
                {schema.type && (
                  <span className="text-xs text-zinc-500 bg-zinc-700 rounded px-1.5 py-0.5">
                    {schema.type}
                  </span>
                )}
              </div>

              <div className="p-4 space-y-4">
                {props.length > 0 && (
                  <div className="rounded border border-white/10 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-800 border-b border-white/10">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-1/4">Property</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-32">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-20">Required</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Enum / Format</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {props.map(([propName, propSchema]) => (
                          <tr key={propName}>
                            <td className="px-3 py-2">
                              <code className="text-xs font-mono text-white/90">{propName}</code>
                            </td>
                            <td className="px-3 py-2 text-xs font-mono text-zinc-400">
                              {schemaType(spec, propSchema)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {required.includes(propName) ? (
                                <span className="text-red-400">yes</span>
                              ) : (
                                <span className="text-zinc-600">no</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-zinc-500">
                              {propSchema.enum
                                ? propSchema.enum.join(" | ")
                                : (propSchema.format ?? "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <p className="text-xs text-zinc-600 mb-1">Sample</p>
                  <pre className="rounded border border-white/10 bg-zinc-950 px-3 py-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
                    {sample}
                  </pre>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
