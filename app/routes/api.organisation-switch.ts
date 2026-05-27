import { getUserProfile } from "~/lib/cognito.server";
import { requireAuth, setActiveOrgAndRole } from "~/lib/session.server";
import { getMemberRole } from "~/repositories/organisation-member.repository.server";

export async function action({ request }: { request: Request }) {
  const { accessToken } = await requireAuth(request);
  const { email } = getUserProfile(accessToken);

  const formData = await request.formData();
  const organisationId = Number(formData.get("organisationId"));
  if (!organisationId) return new Response("Missing organisationId", { status: 400 });

  const role = await getMemberRole(organisationId, email);
  const cookie = await setActiveOrgAndRole(request, organisationId, role);
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie } });
}
