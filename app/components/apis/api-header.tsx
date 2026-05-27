import { Form, Link } from "react-router";

import { Can } from "~/components/can";

interface ApiHeaderProps {
  apiDisplayName: string;
  apiSpecType: string;
  yamlValue: string;
  scope: string;
  editScope: boolean;
  setScope: (v: string) => void;
  setEditScope: (v: boolean) => void;
  hosts: Record<string, string>;
  host: string;
  setHost: (v: string) => void;
  saving: boolean;
  onDeleteClick: () => void;
}

export function ApiHeader({
  apiDisplayName,
  apiSpecType,
  yamlValue,
  scope,
  editScope,
  setScope,
  setEditScope,
  hosts,
  host,
  setHost,
  saving,
  onDeleteClick,
}: ApiHeaderProps) {
  const hostKeys = Object.keys(hosts);

  return (
    <Form method="post">
      <input type="hidden" name="yaml" value={yamlValue} />
      <input type="hidden" name="scope" value={scope} />

      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-zinc-950 sticky top-0 z-10 min-w-0">
        <Link to="/apis" className="text-zinc-400 hover:text-white text-sm shrink-0">
          ← APIs
        </Link>
        <span className="text-white/20 shrink-0">/</span>
        <h1 className="text-sm font-semibold text-white truncate">{apiDisplayName}</h1>
        <span className="text-xs text-zinc-600 font-mono shrink-0">{apiSpecType}</span>

        <div className="flex-1" />

        {/* scope */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-zinc-500">scope</span>
          {editScope ? (
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              onBlur={() => setEditScope(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditScope(false)}
              className="bg-zinc-800 border border-white/20 rounded px-2 py-0.5 text-xs text-white w-28 focus:outline-none focus:border-white/50"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditScope(true)}
              className="text-xs text-white bg-zinc-800 border border-white/20 rounded px-2 py-0.5 hover:border-white/40"
            >
              {scope || <span className="text-zinc-500">—</span>}
              <span className="ml-1.5 text-zinc-600">✎</span>
            </button>
          )}
        </div>

        {/* host */}
        {hostKeys.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-zinc-500">host</span>
            <select
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="bg-zinc-800 border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-white/50"
            >
              {hostKeys.map((k) => (
                <option key={k} value={k}>
                  {k} — {hosts[k]}
                </option>
              ))}
            </select>
          </div>
        )}

        <Can permission="delete:resources">
          <button
            type="button"
            onClick={onDeleteClick}
            className="shrink-0 rounded border border-red-800/40 text-red-400 text-xs px-3 py-1.5 hover:bg-red-950/40 hover:border-red-700 transition-colors"
          >
            Delete
          </button>
        </Can>

        <Can permission="edit:resources">
          <button
            type="submit"
            disabled={saving}
            className="shrink-0 rounded bg-white text-black text-xs font-semibold px-4 py-1.5 hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </Can>
      </div>
    </Form>
  );
}
