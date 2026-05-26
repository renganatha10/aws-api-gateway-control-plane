import { useEffect, useMemo, useState } from "react";
import { useActionData, useNavigation } from "react-router";
import { toast } from "sonner";

import { ApiHeader } from "./api-header";
import { DeleteApiDialog } from "./delete-api-dialog";
import { parseHosts } from "./parse-spec";
import { SourceTab } from "./source-tab";
import { UiTab } from "./ui-tab";

interface ApiItem {
  displayName: string;
  specType: string;
  scope: string | null;
}

interface ApiDetailPageProps {
  api: ApiItem;
  initialYaml: string;
}

type ActionData = { ok?: boolean; error?: string } | undefined;

export function ApiDetailPage({ api, initialYaml }: ApiDetailPageProps) {
  const actionData = useActionData() as ActionData;
  const navigation = useNavigation();
  const saving = navigation.state === "submitting" && !navigation.formData?.get("_intent");

  const [activeTab, setActiveTab] = useState<"source" | "ui">("source");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [yamlValue, setYamlValue] = useState(initialYaml);
  const [scope, setScope] = useState(api.scope ?? "");
  const [editScope, setEditScope] = useState(false);
  const [host, setHost] = useState("");

  const hosts = useMemo(() => parseHosts(yamlValue), [yamlValue]);
  const hostKeys = Object.keys(hosts);

  useEffect(() => {
    if (!host && hostKeys.length > 0) setHost(hostKeys[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostKeys.join(",")]);

  useEffect(() => {
    if (actionData && "ok" in actionData) toast.success("Saved");
    if (actionData && "error" in actionData) toast.error((actionData as { error: string }).error);
  }, [actionData]);

  return (
    <div className="flex flex-col bg-black text-white min-h-svh h-full">
      <ApiHeader
        apiDisplayName={api.displayName}
        apiSpecType={api.specType}
        yamlValue={yamlValue}
        scope={scope}
        editScope={editScope}
        setScope={setScope}
        setEditScope={setEditScope}
        hosts={hosts}
        host={host}
        setHost={setHost}
        saving={saving}
        onDeleteClick={() => setShowDeleteDialog(true)}
      />

      <DeleteApiDialog
        open={showDeleteDialog}
        apiDisplayName={api.displayName}
        onOpenChange={setShowDeleteDialog}
      />

      <div className="flex border-b border-white/10 px-5 bg-zinc-950 shrink-0">
        {(["source", "ui"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "border-b-2 px-4 pb-2 pt-2 text-xs font-medium capitalize transition-colors",
              activeTab === tab
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {tab === "ui" ? "Preview" : "Source"}
          </button>
        ))}
      </div>

      {activeTab === "source" && (
        <SourceTab yamlValue={yamlValue} setYamlValue={setYamlValue} hosts={hosts} host={host} />
      )}
      {activeTab === "ui" && <UiTab yamlValue={yamlValue} />}
    </div>
  );
}
