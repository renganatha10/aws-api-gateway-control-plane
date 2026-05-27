export function getCredentials(): { key: string; secret: string } | null {
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

/**
 * Adds a CNAME record for ACM DNS validation.
 * fullName: the full CNAME name ACM provides (e.g. "_abc.api.example.com.")
 * rootDomain: the GoDaddy-managed root domain (e.g. "example.com")
 * target: the CNAME value ACM provides (e.g. "_xyz.acm-validations.aws.")
 * Non-fatal: logs warnings and returns on failure.
 */
export async function setAcmValidationCname(
  rootDomain: string,
  fullName: string,
  target: string
): Promise<void> {
  const creds = getCredentials();
  if (!creds) {
    console.warn("[godaddy] GODADDY_KEY/SECRET not set — skipping ACM validation CNAME");
    return;
  }

  const name = fullName.endsWith(".") ? fullName.slice(0, -1) : fullName;
  const targetClean = target.endsWith(".") ? target.slice(0, -1) : target;

  const suffix = `.${rootDomain}`;
  let subdomain: string;
  if (name === rootDomain) {
    subdomain = "@";
  } else if (name.endsWith(suffix)) {
    subdomain = name.slice(0, -suffix.length);
  } else {
    console.warn("[godaddy] ACM validation record not under root domain", { name, rootDomain });
    return;
  }

  const url = `https://api.godaddy.com/v1/domains/${rootDomain}/records/CNAME/${subdomain}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `sso-key ${creds.key}:${creds.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ data: targetClean, ttl: 600 }]),
    });
  } catch (err) {
    console.warn("[godaddy] setAcmValidationCname network error", err);
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn(`[godaddy] setAcmValidationCname failed HTTP ${response.status}: ${body}`);
    return;
  }

  console.log("[godaddy] ACM validation CNAME set", { subdomain, target: targetClean, rootDomain });
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
