import { destroyUserSession } from "~/lib/session.server"
import type { Route } from "./+types/logout"

export async function action({ request }: Route.ActionArgs) {
  return destroyUserSession(request)
}

// Redirect to login if someone hits /logout via GET
export async function loader() {
  return new Response(null, { status: 302, headers: { Location: "/" } })
}
