import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { useNavigate } from "react-router"

import type { Gateway } from "~/lib/schema"
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

interface ApiSwitcherProps {
  gateways: Gateway[]
  activeId: number | undefined
  onSelect?: (gateway: Gateway) => void
}

export function ApiSwitcher({ gateways, activeId, onSelect }: ApiSwitcherProps) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const active = gateways.find((g) => g.id === activeId) ?? gateways[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="truncate font-medium">{active?.name ?? "Select Gateway"}</span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-48 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {gateways.map((gw) => (
              <DropdownMenuItem
                key={gw.id}
                onSelect={() => onSelect?.(gw)}
                className="gap-2"
              >
                <span className="flex-1 truncate">{gw.name}</span>
                {gw.id === activeId && <Check className="size-4 shrink-0" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 text-primary font-medium"
              onSelect={() => navigate("/gateway")}
            >
              <Plus className="size-4 shrink-0" />
              Create Gateway
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
