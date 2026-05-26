import { requireAuth, setActiveOrganisationId } from "~/lib/session.server";

export async function action({ request }: { request: Request }) {
  await requireAuth(request);
  const formData = await request.formData();
  const organisationId = Number(formData.get("organisationId"));
  if (!organisationId) return new Response("Missing organisationId", { status: 400 });
  const cookie = await setActiveOrganisationId(request, organisationId);
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie } });
}
