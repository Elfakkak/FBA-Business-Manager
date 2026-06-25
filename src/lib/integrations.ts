// Static integration catalog. DB row (integrations table) holds status/last_sync/
// note/oauth_token per id; this is the display config + credential requirements.
export type CredField = { name: string; label: string; type?: "text" | "password" };
export type IntegrationDef = {
  id: string;
  name: string;
  blurb: string;
  syncs: string[];
  primary?: boolean;
  creds: CredField[];
  docsUrl?: string;
};

export const INTG_DEFS: IntegrationDef[] = [
  {
    id: "amazon", name: "Amazon Seller Central", primary: true,
    blurb: "FBA inventory, orders, sales & fees via the SP-API — the source of truth for stock and revenue.",
    syncs: ["FBA stock", "Inbound shipments", "Sales & traffic", "Fees & settlements"],
    creds: [
      { name: "client_id", label: "LWA Client ID" },
      { name: "client_secret", label: "LWA Client Secret", type: "password" },
      { name: "refresh_token", label: "Refresh token", type: "password" },
    ],
    docsUrl: "https://developer-docs.amazon.com/sp-api/",
  },
  {
    id: "amazonads", name: "Amazon Ads",
    blurb: "Ad spend, ACoS / TACoS and campaigns — feeds P&L and Performance.",
    syncs: ["Ad spend", "Campaigns", "TACoS"],
    creds: [{ name: "client_id", label: "Client ID" }, { name: "client_secret", label: "Client Secret", type: "password" }, { name: "refresh_token", label: "Refresh token", type: "password" }],
  },
  {
    id: "mercury", name: "Mercury",
    blurb: "Bank balances & transactions — your cash source of truth.",
    syncs: ["Balances", "Transactions"],
    creds: [{ name: "api_token", label: "API token", type: "password" }],
  },
  {
    id: "track17", name: "17TRACK",
    blurb: "Container & parcel tracking milestones for your shipments.",
    syncs: ["Tracking milestones"],
    creds: [{ name: "api_key", label: "API key", type: "password" }],
  },
  {
    id: "quickbooks", name: "QuickBooks Online",
    blurb: "Bills / COGS and partner draws as journal entries.",
    syncs: ["Bills", "Journal entries"],
    creds: [{ name: "client_id", label: "Client ID" }, { name: "client_secret", label: "Client Secret", type: "password" }, { name: "refresh_token", label: "Refresh token", type: "password" }],
  },
  {
    id: "wise", name: "Wise",
    blurb: "Live USD ↔ RMB FX rates for landed-cost conversion.",
    syncs: ["FX rates"],
    creds: [{ name: "api_token", label: "API token", type: "password" }],
  },
];

export const INTG_STATUS_TONE: Record<string, "success" | "danger" | "warning" | "muted"> = {
  connected: "success",
  error: "danger",
  syncing: "warning",
  disconnected: "muted",
};
