import { Globe, LayoutList, Link2, Package, UserRound, Users, Zap } from "lucide-react";
import { Link, useLocation } from "react-router";
import { OrgSwitcher } from "~/components/org-switcher";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "~/components/ui/sidebar";
import type { UserProfile } from "~/lib/cognito.server";
import { can } from "~/lib/permissions";
import type { Organisation, OrgRole } from "~/lib/schema";

const mainNavItems = [
  { title: "Products", url: "/products", icon: Package },
  { title: "APIs", url: "/apis", icon: Zap },
  { title: "Environments", url: "/environments", icon: Globe },
  { title: "Plans", url: "/plans", icon: LayoutList },
  { title: "Consumers", url: "/consumers", icon: Users },
  { title: "Domains", url: "/domains", icon: Link2 },
];

function getInitials(given: string, family: string): string {
  return [given[0], family[0]].filter(Boolean).join("").toUpperCase() || "?";
}

export function AppSidebar({
  user,
  organisations,
  activeOrganisationId,
  activeUserRole,
}: {
  user: UserProfile;
  organisations: Organisation[];
  activeOrganisationId: number | null;
  activeUserRole: OrgRole | null;
}) {
  const location = useLocation();
  const activeId = activeOrganisationId ?? organisations[0]?.id;
  const showAll = can(activeUserRole, "view:all");
  const showUsers = can(activeUserRole, "view:users");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Zap className="size-4" />
                </div>
                <span className="font-semibold text-base">ApiGateway</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <OrgSwitcher organisations={organisations} activeId={activeId} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems
                .filter((item) => item.url === "/consumers" || showAll)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showUsers && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/users"}
                      tooltip="Users"
                    >
                      <Link to="/users">
                        <UserRound />
                        <span>Users</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {getInitials(user.given_name, user.family_name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user.given_name || user.family_name
                    ? `${user.given_name} ${user.family_name}`.trim()
                    : user.email}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
