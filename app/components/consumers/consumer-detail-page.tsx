import { useState } from "react";
import { useActionData, useNavigation } from "react-router";
import { ConsumerForm } from "./consumer-form";
import { ConsumerHeader } from "./consumer-header";
import { ConsumerTabBar } from "./consumer-tab-bar";
import { DeleteConsumerDialog } from "./delete-consumer-dialog";
import type { ConsumerItem, EnvironmentOption, PlanOption, ProductOption } from "./types";

interface ConsumerDetailPageProps {
  consumer: ConsumerItem;
  products: ProductOption[];
  environments: EnvironmentOption[];
  plans: PlanOption[];
}

type ActionData = { ok?: boolean; error?: string } | undefined;

export function ConsumerDetailPage({
  consumer,
  products,
  environments,
  plans,
}: ConsumerDetailPageProps) {
  const actionData = useActionData() as ActionData;
  const navigation = useNavigation();
  const submitting =
    navigation.state === "submitting" && navigation.formData?.get("_intent") !== "delete";
  const saved = actionData != null && "ok" in actionData && actionData.ok === true;
  const error = actionData != null && "error" in actionData ? (actionData.error ?? null) : null;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white">
      <ConsumerHeader
        consumerName={consumer.name}
        submitting={submitting}
        saved={saved}
        error={error}
        onDeleteClick={() => setShowDeleteDialog(true)}
      />

      <ConsumerTabBar consumerId={consumer.id} activeTab="details" />

      <ConsumerForm
        consumer={consumer}
        products={products}
        environments={environments}
        plans={plans}
      />

      <DeleteConsumerDialog
        open={showDeleteDialog}
        consumerName={consumer.name}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  );
}
