import { useState } from "react";
import { useNavigation } from "react-router";

import { ApisSection } from "./apis-section";
import { DeleteProductDialog } from "./delete-product-dialog";
import { DeploymentsSection } from "./deployments-section";
import { PlansSection } from "./plans-section";
import { ProductHeader } from "./product-header";
import { ProductLeftNav } from "./product-left-nav";
import { ProductSetupSection } from "./product-setup-section";
import { PublishProductModal } from "./publish-product-modal";
import type {
  ApiItem,
  DeploymentItem,
  EnvironmentItem,
  PlanItem,
  ProductItem,
  ProductSection,
} from "./types";
import { VisibilitySection } from "./visibility-section";

interface ProductDetailPageProps {
  product: ProductItem;
  associatedApis: Array<{ id: number }>;
  associatedPlans: Array<{ id: number }>;
  allApis: ApiItem[];
  allPlans: PlanItem[];
  deployments: DeploymentItem[];
  allEnvironments: EnvironmentItem[];
}

export function ProductDetailPage({
  product,
  associatedApis,
  associatedPlans,
  allApis,
  allPlans,
  deployments,
  allEnvironments,
}: ProductDetailPageProps) {
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" && navigation.formData?.get("_intent") === "update";

  const [activeSection, setActiveSection] = useState<ProductSection>("Product setup");

  const [displayName, setDisplayName] = useState(product.displayName);
  const [description, setDescription] = useState(product.description ?? "");
  const [visibility, setVisibility] = useState(product.visibility);

  const [selectedApiIds, setSelectedApiIds] = useState<Set<number>>(
    () => new Set(associatedApis.map((a) => a.id))
  );
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(
    () => new Set(associatedPlans.map((p) => p.id))
  );

  const displayedApis = allApis.filter((a) => selectedApiIds.has(a.id));
  const availableApis = allApis.filter((a) => !selectedApiIds.has(a.id));
  const displayedPlans = allPlans.filter((p) => selectedPlanIds.has(p.id));
  const availablePlans = allPlans.filter((p) => !selectedPlanIds.has(p.id));

  const [dropdownApiId, setDropdownApiId] = useState("");
  const [dropdownPlanId, setDropdownPlanId] = useState("");

  function addApi() {
    const id = Number(dropdownApiId);
    if (!id) return;
    setSelectedApiIds((prev) => new Set([...prev, id]));
    setDropdownApiId("");
  }

  function removeApi(id: number) {
    setSelectedApiIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }

  function addPlan() {
    const id = Number(dropdownPlanId);
    if (!id) return;
    setSelectedPlanIds((prev) => new Set([...prev, id]));
    setDropdownPlanId("");
  }

  function removePlan(id: number) {
    setSelectedPlanIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }

  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(
    () => deployments[0]?.environmentId ?? null
  );

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  return (
    <div className="flex flex-col min-h-full bg-white">
      <ProductHeader
        displayName={displayName}
        description={description}
        visibility={visibility}
        selectedApiIds={selectedApiIds}
        selectedPlanIds={selectedPlanIds}
        saving={saving}
        onPublishClick={() => setShowPublishModal(true)}
        onDeleteClick={() => setShowDeleteDialog(true)}
      />

      <DeleteProductDialog
        open={showDeleteDialog}
        productName={product.displayName}
        onOpenChange={setShowDeleteDialog}
      />

      <PublishProductModal
        open={showPublishModal}
        product={product}
        environments={allEnvironments}
        onClose={() => setShowPublishModal(false)}
      />

      <div className="flex flex-1">
        <ProductLeftNav activeSection={activeSection} onSectionChange={setActiveSection} />

        <main className="flex-1 px-8 py-6">
          {activeSection === "Product setup" && (
            <ProductSetupSection
              productName={product.name}
              displayName={displayName}
              description={description}
              onDisplayNameChange={setDisplayName}
              onDescriptionChange={setDescription}
            />
          )}

          {activeSection === "Visibility" && (
            <VisibilitySection visibility={visibility} onVisibilityChange={setVisibility} />
          )}

          {activeSection === "APIs" && (
            <ApisSection
              displayedApis={displayedApis}
              availableApis={availableApis}
              dropdownApiId={dropdownApiId}
              onDropdownChange={setDropdownApiId}
              onAdd={addApi}
              onRemove={removeApi}
            />
          )}

          {activeSection === "Plans" && (
            <PlansSection
              displayedPlans={displayedPlans}
              availablePlans={availablePlans}
              dropdownPlanId={dropdownPlanId}
              onDropdownChange={setDropdownPlanId}
              onAdd={addPlan}
              onRemove={removePlan}
            />
          )}

          {activeSection === "Deployments" && (
            <DeploymentsSection
              deployments={deployments}
              allEnvironments={allEnvironments}
              selectedEnvId={selectedEnvId}
              onSelectEnv={(id) => setSelectedEnvId(id)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
