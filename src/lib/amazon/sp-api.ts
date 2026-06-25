// Minimal Selling Partner API client. Modern SP-API (post Oct-2023) authenticates
// with an LWA access token only (no AWS SigV4), passed as `x-amz-access-token`.
// We exchange the stored refresh token for a short-lived access token, then call
// the FBA Inventory endpoint. Kept dependency-free (global fetch).

export type AmazonCreds = {
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  marketplace_id?: string;
  region?: string; // "na" | "eu" | "fe"
};

const REGION_HOST: Record<string, string> = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
};

// US is the default marketplace if none is configured.
export const DEFAULT_MARKETPLACE = "ATVPDKIKX0DER";

// Credentials from environment (fallback when none are stored on the integration row).
export function spCredsFromEnv(): AmazonCreds {
  return {
    client_id: process.env.AMAZON_SP_CLIENT_ID,
    client_secret: process.env.AMAZON_SP_CLIENT_SECRET,
    refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN,
    marketplace_id: process.env.AMAZON_SP_MARKETPLACE_ID,
    region: process.env.AMAZON_SP_REGION,
  };
}

export class SpApiError extends Error {}

function hostFor(region?: string) {
  return REGION_HOST[(region ?? "na").toLowerCase()] ?? REGION_HOST.na;
}

async function getAccessToken(creds: AmazonCreds): Promise<string> {
  if (!creds.client_id || !creds.client_secret || !creds.refresh_token) {
    throw new SpApiError("Missing LWA credentials (Client ID, Client Secret, Refresh token).");
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
    throw new SpApiError(json.error_description || json.error || `LWA token exchange failed (HTTP ${res.status}).`);
  }
  return json.access_token;
}

export type FbaInventoryRow = {
  sellerSku: string;
  fnSku: string | null;
  asin: string | null;
  total: number;        // total units at Amazon (on-hand)
  fulfillable: number;  // available to sell
  inbound: number;      // working + shipped + receiving
  reserved: number;
  unfulfillable: number;
};

// Pulls every FBA inventory summary for the marketplace, following nextToken.
export async function fetchFbaInventory(creds: AmazonCreds): Promise<FbaInventoryRow[]> {
  const token = await getAccessToken(creds);
  const host = hostFor(creds.region);
  const marketplace = creds.marketplace_id || DEFAULT_MARKETPLACE;
  const rows: FbaInventoryRow[] = [];
  let nextToken: string | undefined;

  do {
    const qs = new URLSearchParams({
      details: "true",
      granularityType: "Marketplace",
      granularityId: marketplace,
      marketplaceIds: marketplace,
    });
    if (nextToken) qs.set("nextToken", nextToken);

    const res = await fetch(`${host}/fba/inventory/v1/summaries?${qs}`, {
      headers: { "x-amz-access-token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      payload?: { inventorySummaries?: RawSummary[] };
      pagination?: { nextToken?: string };
      errors?: { message?: string }[];
    };
    if (!res.ok) {
      throw new SpApiError(json.errors?.[0]?.message || `FBA Inventory request failed (HTTP ${res.status}).`);
    }
    for (const s of json.payload?.inventorySummaries ?? []) rows.push(normalize(s));
    nextToken = json.pagination?.nextToken;
  } while (nextToken);

  return rows;
}

type RawSummary = {
  sellerSku?: string;
  fnSku?: string;
  asin?: string;
  totalQuantity?: number;
  inventoryDetails?: {
    fulfillableQuantity?: number;
    inboundWorkingQuantity?: number;
    inboundShippedQuantity?: number;
    inboundReceivingQuantity?: number;
    reservedQuantity?: { totalReservedQuantity?: number };
    unfulfillableQuantity?: { totalUnfulfillableQuantity?: number };
  };
};

function normalize(s: RawSummary): FbaInventoryRow {
  const d = s.inventoryDetails ?? {};
  return {
    sellerSku: s.sellerSku ?? "",
    fnSku: s.fnSku ?? null,
    asin: s.asin ?? null,
    total: s.totalQuantity ?? 0,
    fulfillable: d.fulfillableQuantity ?? 0,
    inbound: (d.inboundWorkingQuantity ?? 0) + (d.inboundShippedQuantity ?? 0) + (d.inboundReceivingQuantity ?? 0),
    reserved: d.reservedQuantity?.totalReservedQuantity ?? 0,
    unfulfillable: d.unfulfillableQuantity?.totalUnfulfillableQuantity ?? 0,
  };
}
