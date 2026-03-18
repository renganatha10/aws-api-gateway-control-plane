import { Outlet } from "react-router"

import { AppSidebar } from "~/components/app-sidebar"
import { Separator } from "~/components/ui/separator"
import {
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"

export default function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-svh">
        <header className="flex h-14 items-center gap-2 border-b px-4 bg-background sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  )
}
