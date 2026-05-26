import { useState } from "react";

import { Separator } from "~/components/ui/separator";
import { DeleteDomainDialog } from "./delete-domain-dialog";
import { DomainHeader } from "./domain-header";
import { DomainInfoSection } from "./domain-info-section";
import { RouteMappingsSection } from "./route-mappings-section";
import type { DomainItem, MappingEntry, SyncedApi } from "./types";

interface DomainDetailPageProps {
  domain: DomainItem;
  mappings: Array<{ apiId: number; stage: string; basePath: string }>;
  syncedApis: SyncedApi[];
}

export function DomainDetailPage({ domain, mappings, syncedApis }: DomainDetailPageProps) {
  const [entries, setEntries] = useState<MappingEntry[]>(() =>
    mappings.length > 0
      ? mappings.map((m, i) => ({
          key: i,
          apiId: String(m.apiId),
          stage: m.stage,
          basePath: m.basePath,
        }))
      : [{ key: 0, apiId: "", stage: "", basePath: "" }]
  );
  const [nextKey, setNextKey] = useState(mappings.length || 1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  function addEntry() {
    setEntries((prev) => [...prev, { key: nextKey, apiId: "", stage: "", basePath: "" }]);
    setNextKey((k) => k + 1);
  }

  function removeEntry(key: number) {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  }

  function updateEntry(key: number, field: keyof Omit<MappingEntry, "key">, value: string) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)));
  }

  return (
    <div className="flex flex-col min-h-full bg-white">
      <DomainHeader domain={domain} onDeleteClick={() => setShowDeleteDialog(true)} />

      <DeleteDomainDialog
        open={showDeleteDialog}
        domainName={domain.domainName}
        onOpenChange={setShowDeleteDialog}
      />

      <div className="flex flex-col gap-8 px-6 py-6 max-w-2xl">
        <DomainInfoSection domain={domain} />
        <Separator />
        <RouteMappingsSection
          entries={entries}
          syncedApis={syncedApis}
          onAdd={addEntry}
          onUpdate={updateEntry}
          onRemove={removeEntry}
        />
      </div>
    </div>
  );
}
