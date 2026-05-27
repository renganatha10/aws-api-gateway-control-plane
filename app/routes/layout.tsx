import { Form, Outlet, redirect, useLoaderData } from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { getUserProfile } from "~/lib/cognito.server";
import {
  getActiveOrganisationId,
  requireAuth,
  setActiveOrgAndRole,
} from "~/lib/session.server";
import { getMemberRole } from "~/repositories/organisation-member.repository.server";
import {
  countOrganisations,
  listOrganisations,
} from "~/repositories/organisation.repository.server";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request);
  const user = getUserProfile(accessToken);

  const url = new URL(request.url);
  if (url.pathname !== "/organisation") {
    if ((await countOrganisations(user.email)) === 0) throw redirect("/organisation");
  }

  const organisations = await listOrganisations(user.email);
  let activeOrganisationId = await getActiveOrganisationId(request);
  const headers = new Headers();

  if (!activeOrganisationId && organisations.length > 0) {
    activeOrganisationId = organisations[0].id;
  }

  // Always fetch fresh from DB so role changes are never stale in the UI,
  // then cache in the session so action requirePermission calls skip the DB.
  const activeUserRole = activeOrganisationId
    ? await getMemberRole(activeOrganisationId, user.email)
    : null;

  if (activeOrganisationId) {
    headers.set("Set-Cookie", await setActiveOrgAndRole(request, activeOrganisationId, activeUserRole));
  }

  // Portal-users can only access /consumers and resource API routes
  if (activeUserRole === "portal-user") {
    const isAllowed =
      url.pathname.startsWith("/consumers") || url.pathname.startsWith("/api/");
    if (!isAllowed) throw redirect("/consumers");
  }

  return Response.json(
    { user, organisations, activeOrganisationId, activeUserRole },
    { headers }
  );
}

export default function Layout() {
  const { user, organisations, activeOrganisationId, activeUserRole } =
    useLoaderData<typeof loader>();

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        organisations={organisations}
        activeOrganisationId={activeOrganisationId}
        activeUserRole={activeUserRole}
      />
      <main className="flex-1 flex flex-col min-h-svh">
        <header className="flex h-14 items-center gap-2 border-b px-4 bg-background sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex-1" />
          <Form method="post" action="/logout">
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </Form>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
}
