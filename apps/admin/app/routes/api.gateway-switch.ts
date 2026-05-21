import { requireAuth } from "~/lib/session.server"
import { setActiveGatewayId } from "~/lib/session.server"

export async function action({ request }: { request: Request }) {
  await requireAuth(request)
  const formData  = await request.formData()
  const gatewayId = Number(formData.get("gatewayId"))
  if (!gatewayId) return new Response("Missing gatewayId", { status: 400 })
  const cookie = await setActiveGatewayId(request, gatewayId)
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie } })
}
