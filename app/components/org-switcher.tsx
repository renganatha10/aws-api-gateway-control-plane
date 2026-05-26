import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useFetcher, useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import type { Organisation } from "~/lib/schema";

interface OrgSwitcherProps {
  organisations: Organisation[];
  activeId: number | undefined;
}

export function OrgSwitcher({ organisations, activeId }: OrgSwitcherProps) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const active = organisations.find((o) => o.id === activeId) ?? organisations[0];

  function handleSelect(org: Organisation) {
    fetcher.submit(
      { organisationId: String(org.id) },
      { method: "post", action: "/api/organisation-switch" }
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="truncate font-medium">{active?.name ?? "Select Organisation"}</span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-48 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {organisations.map((org) => (
              <DropdownMenuItem key={org.id} onSelect={() => handleSelect(org)} className="gap-2">
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === activeId && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 text-primary font-medium"
              onSelect={() => navigate("/organisation")}
            >
              <Plus className="size-4 shrink-0" />
              Create Organisation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
