import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import type { DomainItem } from "./types";

interface DomainHeaderProps {
  domain: DomainItem;
  onDeleteClick: () => void;
}

export function DomainHeader({ domain, onDeleteClick }: DomainHeaderProps) {
  return (
    <>
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/domains" className="hover:underline">
          Domains
        </Link>
        {" /"}
      </div>

      <div className="flex items-center justify-between gap-4 px-6 pt-1 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 truncate">{domain.domainName}</h1>

        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={onDeleteClick}
        >
          Delete
        </Button>
      </div>
    </>
  );
}
