import { Trash2 } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";

interface ConsumerHeaderProps {
  consumerName: string;
  submitting: boolean;
  saved: boolean;
  error: string | null;
  onDeleteClick: () => void;
}

export function ConsumerHeader({
  consumerName,
  submitting,
  saved,
  error,
  onDeleteClick,
}: ConsumerHeaderProps) {
  return (
    <>
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/consumers" className="hover:underline">
          Consumers
        </Link>
        {" /"}
      </div>

      <div className="flex items-center justify-between px-6 pt-1 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 truncate">{consumerName}</h1>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">Saved</span>}
          {error && <span className="text-xs text-destructive">{error}</span>}
          <Button
            type="submit"
            form="consumer-form"
            disabled={submitting}
            className="bg-black hover:bg-gray-900 text-white px-6"
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={onDeleteClick}
          >
            <Trash2 className="size-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </>
  );
}
