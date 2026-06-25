// Minimal Amazon Advertising API client. Same LWA OAuth as SP-API, but a different
// host and required headers (ClientId + Bearer token). The first real call is
// GET /v2/profiles — it validates the credentials and returns the advertiser
// profile(s); the profileId is required for every reporting call afterwards.

export type AdsCreds = {
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  region?: string; // "na" | "eu" | "fe"
};

const REGION_HOST: Record<string, string> = {
  na: "https://advertising-api.amazon.com",
  eu: "https://advertising-api-eu.amazon.com",
  fe: "https://advertising-api-fp.amazon.com",
};

export class AdsApiError extends Error {}

function hostFor(region?: string) {
  return REGION_HOST[(region ?? "na").toLowerCase()] ?? REGION_HOST.na;
}

async function getAccessToken(creds: AdsCreds): Promise<string> {
  if (!creds.client_id || !creds.client_secret || !creds.refresh_token) {
    throw new AdsApiError("Missing LWA credentials (Client ID, Client Secret, Refresh token).");
  }
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refresh_token,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new AdsApiError(json.error_description || json.error || `LWA token exchange failed (HTTP ${res.status}).`);
  }
  return json.access_token;
}

export type AdsProfile = {
  profileId: number;
  countryCode: string | null;
  currencyCode: string | null;
  accountName: string | null;
  accountType: string | null;
};

export async function fetchAdsProfiles(creds: AdsCreds): Promise<AdsProfile[]> {
  const token = await getAccessToken(creds);
  const res = await fetch(`${hostFor(creds.region)}/v2/profiles`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Amazon-Advertising-API-ClientId": creds.client_id as string,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as
    | RawProfile[]
    | { message?: string; code?: string };
  if (!res.ok) {
    const msg = !Array.isArray(json) ? json.message : undefined;
    throw new AdsApiError(msg || `Amazon Ads profiles request failed (HTTP ${res.status}).`);
  }
  if (!Array.isArray(json)) return [];
  return json.map((p) => ({
    profileId: p.profileId,
    countryCode: p.countryCode ?? null,
    currencyCode: p.currencyCode ?? null,
    accountName: p.accountInfo?.name ?? null,
    accountType: p.accountInfo?.type ?? null,
  }));
}

type RawProfile = {
  profileId: number;
  countryCode?: string;
  currencyCode?: string;
  accountInfo?: { name?: string; type?: string };
};
