import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useNavigate } from "react-router"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar"

export interface ApiEntry {
  id: string
  name: string
}

interface ApiSwitcherProps {
  apis: ApiEntry[]
  activeApiId: string
  onSelect?: (api: ApiEntry) => void
}

export function ApiSwitcher({ apis, activeApiId, onSelect }: ApiSwitcherProps) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const active = apis.find((a) => a.id === activeApiId) ?? apis[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="truncate font-medium">{active?.name ?? "Select API"}</span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-48 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {apis.map((api) => (
              <DropdownMenuItem
                key={api.id}
                onSelect={() => onSelect?.(api)}
                className="gap-2"
              >
                <span className="flex-1 truncate">{api.name}</span>
                {api.id === activeApiId && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 text-primary font-medium"
              onSelect={() => navigate("/onboard")}
            >
              <Plus className="size-4 shrink-0" />
              Create API
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
