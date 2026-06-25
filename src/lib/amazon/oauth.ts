// SP-API "website authorization workflow" (Login with Amazon for Seller Central).
// We send the seller to the Seller Central consent page; Amazon redirects back with
// an `spapi_oauth_code`, which we exchange for a long-lived refresh token.

const CONSENT_HOST: Record<string, string> = {
  na: "https://sellercentral.amazon.com",
  eu: "https://sellercentral-europe.amazon.com",
  fe: "https://sellercentral.amazon.co.jp",
};

export function consentHost(region?: string) {
  return CONSENT_HOST[(region ?? "na").toLowerCase()] ?? CONSENT_HOST.na;
}

// Build the Seller Central consent URL. `version=beta` is required while the SP-API
// app is in Draft (private apps usually are); harmless to keep for self-use apps.
export function buildConsentUrl(opts: { appId: string; region?: string; redirectUri: string; state: string }) {
  const qs = new URLSearchParams({
    application_id: opts.appId,
    state: opts.state,
    redirect_uri: opts.redirectUri,
    version: "beta",
  });
  return `${consentHost(opts.region)}/apps/authorize/consent?${qs}`;
}

// Exchange the one-time spapi_oauth_code for a refresh token.
export async function exchangeAuthCode(opts: {
  code: string; clientId: string; clientSecret: string; redirectUri: string;
}): Promise<{ refresh_token: string }> {
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { refresh_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.refresh_token) {
    throw new Error(json.error_description || json.error || `Token exchange failed (HTTP ${res.status}).`);
  }
  return { refresh_token: json.refresh_token };
}
