import { Separator } from "~/components/ui/separator";
import type { DeploymentItem, EnvironmentItem } from "./types";

interface DeploymentsSectionProps {
  deployments: DeploymentItem[];
  allEnvironments: EnvironmentItem[];
  selectedEnvId: number | null;
  onSelectEnv: (id: number) => void;
}

export function DeploymentsSection({
  deployments,
  allEnvironments,
  selectedEnvId,
  onSelectEnv,
}: DeploymentsSectionProps) {
  const selectedDeployment = deployments.find((d) => d.environmentId === selectedEnvId) ?? null;

  return (
    <div className="flex h-full -mx-8 -my-6">
      <aside className="w-44 shrink-0 border-r border-gray-200 pt-2">
        {deployments.length === 0 ? (
          <p className="px-5 py-3 text-sm text-muted-foreground">No deployments yet</p>
        ) : (
          deployments.map((d) => {
            const env = allEnvironments.find((e) => e.id === d.environmentId);
            const active = d.environmentId === selectedEnvId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectEnv(d.environmentId)}
                className={[
                  "w-full text-left py-2 text-sm transition-colors",
                  active
                    ? "border-l-4 border-blue-600 pl-5 font-semibold text-gray-900 bg-gray-50"
                    : "border-l-4 border-transparent pl-5 text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                ].join(" ")}
              >
                {env?.name ?? `env ${d.environmentId}`}
              </button>
            );
          })
        )}
      </aside>

      <div className="flex-1 px-8 py-6 space-y-6">
        {selectedDeployment ? (
          <>
            <div>
              <h2 className="text-base font-medium text-amber-600">Deployment</h2>
              <Separator className="mt-2" />
            </div>

            <div className="space-y-5 max-w-xl">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">Status</p>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 capitalize">
                  {selectedDeployment.status}
                </span>
              </div>

              {selectedDeployment.invokeUrl ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">Invoke URL</p>
                  <div className="flex items-center gap-2">
                    <p
                      className="font-mono text-sm text-gray-800 select-all break-all flex-1"
                      data-testid="invoke-url"
                    >
                      {selectedDeployment.invokeUrl}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(selectedDeployment.invokeUrl ?? "")
                      }
                      className="shrink-0 p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Copy"
                    >
                      <svg
                        aria-hidden="true"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">Invoke URL</p>
                  <p className="text-sm text-muted-foreground">—</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t border-gray-100">
                <div>
                  <span className="font-medium text-gray-500">Deployed by</span>
                  <p className="mt-0.5">{selectedDeployment.createdBy}</p>
                  <p>{new Date(selectedDeployment.createdAt).toLocaleString()}</p>
                </div>
                {selectedDeployment.updatedBy &&
                  selectedDeployment.updatedBy !== selectedDeployment.createdBy && (
                    <div>
                      <span className="font-medium text-gray-500">Last redeployed by</span>
                      <p className="mt-0.5">{selectedDeployment.updatedBy}</p>
                      <p>{new Date(selectedDeployment.updatedAt).toLocaleString()}</p>
                    </div>
                  )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <svg
              aria-hidden="true"
              className="size-10 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <p className="text-sm">Select an environment to view its deployment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
