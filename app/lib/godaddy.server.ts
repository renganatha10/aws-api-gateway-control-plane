function getCredentials(): { key: string; secret: string } | null {
  const key = process.env.GODADDY_KEY;
  const secret = process.env.GODADDY_SECRET;
  if (!key || !secret) return null;
  return { key, secret };
}

/** Returns the subdomain portion of a full domain given its root domain.
 *  e.g. ("api.example.com", "example.com") → "api"
 *  Returns null if godaddyDomain is blank or fullDomain is not a subdomain of it. */
export function extractSubdomain(fullDomain: string, godaddyDomain: string): string | null {
  if (!godaddyDomain) return null;
  const suffix = `.${godaddyDomain}`;
  if (fullDomain.endsWith(suffix)) {
    return fullDomain.slice(0, -suffix.length);
  }
  return null;
}

/** Sets a CNAME record in GoDaddy. Non-fatal: logs a warning and returns on failure. */
export async function setCname(
  godaddyDomain: string,
  subdomain: string,
  target: string
): Promise<void> {
  const creds = getCredentials();
  if (!creds) {
    console.warn("[godaddy] GODADDY_KEY/SECRET not set — skipping CNAME update");
    return;
  }

  const url = `https://api.godaddy.com/v1/domains/${godaddyDomain}/records/CNAME/${subdomain}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `sso-key ${creds.key}:${creds.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ data: target, ttl: 600 }]),
    });
  } catch (err) {
    console.warn("[godaddy] setCname network error", err);
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn(`[godaddy] setCname failed HTTP ${response.status}: ${body}`);
    return;
  }

  console.log("[godaddy] CNAME set", { subdomain, target, godaddyDomain });
}

/** Removes a CNAME record from GoDaddy. Non-fatal: logs a warning and returns on failure. */
export async function removeCname(godaddyDomain: string, subdomain: string): Promise<void> {
  const creds = getCredentials();
  if (!creds) return;

  const url = `https://api.godaddy.com/v1/domains/${godaddyDomain}/records/CNAME/${subdomain}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `sso-key ${creds.key}:${creds.secret}`,
      },
    });
  } catch (err) {
    console.warn("[godaddy] removeCname network error", err);
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn(`[godaddy] removeCname failed HTTP ${response.status}: ${body}`);
    return;
  }

  console.log("[godaddy] CNAME removed", { subdomain, godaddyDomain });
}
