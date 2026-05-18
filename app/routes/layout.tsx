import { Form, Outlet, redirect, useLoaderData } from "react-router"

import { getUserProfile } from "~/lib/keycloak.server"
import { getActiveGatewayId, requireAuth, setActiveGatewayId } from "~/lib/session.server"
import { countGateways, listGateways } from "~/repositories/gateway.repository.server"
import { AppSidebar } from "~/components/app-sidebar"
import { Separator } from "~/components/ui/separator"
import {
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { Button } from "~/components/ui/button"
import type { Route } from "./+types/layout"

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request)
  const user = getUserProfile(accessToken)

  const url = new URL(request.url)
  if (url.pathname !== "/gateway") {
    if ((await countGateways(user.email)) === 0) throw redirect("/gateway")
  }

  const gateways        = await listGateways(user.email)
  let activeGatewayId   = await getActiveGatewayId(request)
  const headers         = new Headers()

  // Auto-seed session with first gateway if none is set yet
  if (!activeGatewayId && gateways.length > 0) {
    activeGatewayId = gateways[0].id
    headers.set("Set-Cookie", await setActiveGatewayId(request, activeGatewayId))
  }

  return Response.json({ user, gateways, activeGatewayId }, { headers })
}

export default function Layout() {
  const { user, gateways, activeGatewayId } = useLoaderData<typeof loader>()

  return (
    <SidebarProvider>
      <AppSidebar user={user} gateways={gateways} activeGatewayId={activeGatewayId} />
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
  )
}
