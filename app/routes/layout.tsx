import { Form, Outlet, redirect, useLoaderData } from "react-router"

import { getUserProfile } from "~/lib/cognito.server"
import { getActiveOrganisationId, requireAuth, setActiveOrganisationId } from "~/lib/session.server"
import { countOrganisations, listOrganisations } from "~/repositories/organisation.repository.server"
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
  if (url.pathname !== "/organisation") {
    if ((await countOrganisations(user.email)) === 0) throw redirect("/organisation")
  }

  const organisations        = await listOrganisations(user.email)
  let activeOrganisationId   = await getActiveOrganisationId(request)
  const headers              = new Headers()

  if (!activeOrganisationId && organisations.length > 0) {
    activeOrganisationId = organisations[0].id
    headers.set("Set-Cookie", await setActiveOrganisationId(request, activeOrganisationId))
  }

  return Response.json({ user, organisations, activeOrganisationId }, { headers })
}

export default function Layout() {
  const { user, organisations, activeOrganisationId } = useLoaderData<typeof loader>()

  return (
    <SidebarProvider>
      <AppSidebar user={user} organisations={organisations} activeOrganisationId={activeOrganisationId} />
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
