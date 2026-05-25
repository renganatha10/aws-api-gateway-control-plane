import { useLoaderData } from "react-router"

import { getActiveOrganisationId, requireAuth } from "~/lib/session.server"
import { findConsumerWithDetailById } from "~/repositories/consumer.repository.server"
import { listApisWithSpecByProduct } from "~/repositories/api-association.repository.server"
import { listDeploymentsByProduct } from "~/repositories/product-deployment.repository.server"
import { ConsumerTryoutPage } from "~/components/consumers/consumer-tryout-page"
import type { Route } from "./+types/consumers.$id.tryout"

export function meta({ data }: Route.MetaArgs) {
  const name = (data as { consumer?: { name?: string } })?.consumer?.name
  return [{ title: name ? `Try Out — ${name}` : "Try Out" }]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request)
  await getActiveOrganisationId(request)

  const consumer = await findConsumerWithDetailById(Number(params.id))
  if (!consumer) throw new Response("Not found", { status: 404 })

  const [productApis, deployments] = await Promise.all([
    listApisWithSpecByProduct(consumer.productId),
    listDeploymentsByProduct(consumer.productId),
  ])

  const invokeUrl =
    deployments.find((d) => d.environmentId === consumer.environmentId)?.invokeUrl ?? null

  return { consumer, productApis, invokeUrl }
}

export default function ConsumerTryoutRoute() {
  const { consumer, productApis, invokeUrl } = useLoaderData<typeof loader>()
  return (
    <ConsumerTryoutPage
      consumer={consumer}
      productApis={productApis}
      invokeUrl={invokeUrl}
    />
  )
}
