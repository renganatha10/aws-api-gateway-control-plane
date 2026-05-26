import { Rocket } from "lucide-react";
import { Form, Link } from "react-router";

import { Button } from "~/components/ui/button";

interface ProductHeaderProps {
  displayName: string;
  description: string;
  visibility: string;
  selectedApiIds: Set<number>;
  selectedPlanIds: Set<number>;
  saving: boolean;
  onPublishClick: () => void;
  onDeleteClick: () => void;
}

export function ProductHeader({
  displayName,
  description,
  visibility,
  selectedApiIds,
  selectedPlanIds,
  saving,
  onPublishClick,
  onDeleteClick,
}: ProductHeaderProps) {
  return (
    <>
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/products" className="hover:underline">
          Products
        </Link>
        {" /"}
      </div>

      <div className="flex items-center justify-between gap-4 px-6 pt-1 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 truncate">{displayName}</h1>

        <div className="flex items-center gap-2 shrink-0">
          <Form method="post">
            <input type="hidden" name="_intent" value="update" />
            <input type="hidden" name="displayName" value={displayName} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="visibility" value={visibility} />
            {[...selectedApiIds].map((id) => (
              <input key={id} type="hidden" name="apiIds" value={id} />
            ))}
            {[...selectedPlanIds].map((id) => (
              <input key={id} type="hidden" name="planIds" value={id} />
            ))}
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </Form>

          <Button variant="outline" size="sm" onClick={onPublishClick}>
            <Rocket className="size-4 mr-1.5" />
            Publish
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={onDeleteClick}
          >
            Delete
          </Button>
        </div>
      </div>
    </>
  );
}
