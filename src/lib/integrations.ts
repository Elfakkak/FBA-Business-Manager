// Static integration catalog + data streams (from the prototype integrations-data.jsx
// + IG_STREAMS). DB row (integrations table) holds status/last_sync/note/oauth_token.
export type CredField = { name: string; label: string; type?: "text" | "password" };
export type Stream = { name: string; api: string; feeds: string; detail: string };
export type Tone = "info" | "warning" | "brand" | "success" | "danger";
export type IntegrationDef = {
  id: string;
  name: string;
  blurb: string;
  syncs: string;            // short summary line
  tone: Tone;
  account?: string;
  primary?: boolean;
  creds: CredField[];
  streams: Stream[];
  docsUrl?: string;
  howto: string[];          // step-by-step to obtain the credentials
};

const OAUTH: CredField[] = [
  { name: "client_id", label: "Client ID" },
  { name: "client_secret", label: "Client Secret", type: "password" },
  { name: "refresh_token", label: "Refresh token", type: "password" },
];

export const INTG_DEFS: IntegrationDef[] = [
  {
    id: "amazon", name: "Amazon Seller Central", tone: "warning", primary: true,
    account: "Seller ID A1B2C3DEF4",
    blurb: "Pulls live FBA stock, inbound shipment status and order data into Vyonix.",
    syncs: "FBA inventory · inbound shipments · orders",
    creds: [
      { name: "app_id", label: "SP-API App ID (amzn1.sp.solution… / amzn1.application-oa2-client…)" },
      { name: "client_id", label: "LWA Client ID" },
      { name: "client_secret", label: "LWA Client Secret", type: "password" },
      { name: "marketplace_id", label: "Marketplace ID (US = ATVPDKIKX0DER)" },
      { name: "region", label: "Region (na / eu / fe)" },
    ],
    docsUrl: "https://developer-docs.amazon.com/sp-api/",
    streams: [
      { name: "Sales & units", api: "Sales & Traffic report", feeds: "P&L · Performance", detail: "Units sold + gross sales per SKU/day" },
      { name: "Fees & settlements", api: "Finances API · listFinancialEvents", feeds: "Finance · P&L", detail: "Referral, FBA, ads, refunds, payouts" },
      { name: "FBA inventory", api: "FBA Inventory API", feeds: "Inventory · Reorder", detail: "On-hand, reserved, inbound, velocity" },
      { name: "Orders", api: "Orders API", feeds: "Orders", detail: "Customer orders + fulfillment status" },
    ],
    howto: [
      "In Seller Central → Apps & Services → Develop Apps, open your SP-API app (Inventory/Orders/Finance roles) → Edit app → add this exact OAuth Redirect URI: <this site>/integrations/amazon/callback",
      "Copy the App ID, and the LWA Client ID & Client Secret.",
      "Enter them below with your Marketplace ID (US = ATVPDKIKX0DER) and Region (na/eu/fe), then Save.",
      "Click ‘Authorize with Amazon’ — you'll approve on Seller Central and be sent back. No refresh token to copy by hand.",
      "On return, Vyonix exchanges the code for a refresh token and pulls your live FBA inventory.",
    ],
  },
  {
    id: "amazonads", name: "Amazon Ads", tone: "warning",
    blurb: "Pulls Sponsored Products/Brands ad spend and performance so the P&L can break ads out of the Amazon payout and show true ACoS / TACoS per product.",
    syncs: "PPC spend · ACoS / TACoS · campaigns",
    creds: OAUTH,
    streams: [
      { name: "Ad spend", api: "Amazon Ads API · reports", feeds: "P&L · Performance", detail: "Sponsored Products/Brands daily spend per campaign/SKU" },
      { name: "ACoS / TACoS", api: "Amazon Ads API · reports", feeds: "P&L · Performance", detail: "Ad cost of sales — total & per product" },
      { name: "Campaign performance", api: "Amazon Ads API · campaigns", feeds: "Performance", detail: "Impressions, clicks, conversions, spend" },
    ],
    howto: [
      "In the Amazon Ads console, register an Amazon Ads API application.",
      "Generate the LWA Client ID & Secret for the Ads API.",
      "Authorize the app on your Ads account to obtain a Refresh token.",
      "Paste the three values below.",
    ],
  },
  {
    id: "mercury", name: "Mercury", tone: "info", account: "Checking ···· 4471",
    blurb: "Reads cleared payments and balances so invoice payments reconcile automatically.",
    syncs: "Bank balance · payments · FX rates",
    creds: [{ name: "api_token", label: "API token", type: "password" }],
    streams: [
      { name: "Balances", api: "Mercury API · accounts", feeds: "Finance · Dashboard", detail: "Cleared balance per account" },
      { name: "Transactions", api: "Mercury API · transactions", feeds: "Finance · Review", detail: "Money in/out for categorization" },
      { name: "FX rates", api: "Mercury API · rates", feeds: "Finance", detail: "USD↔RMB reference rate" },
    ],
    howto: ["Open Mercury → Settings → API tokens.", "Create a read-only API token.", "Paste it below."],
  },
  {
    id: "track17", name: "17TRACK", tone: "info",
    blurb: "Universal carrier tracking — paste a booking/container number and Vyonix polls live milestones for the Shipments timeline.",
    syncs: "Live container & parcel tracking",
    creds: [{ name: "api_key", label: "API key", type: "password" }],
    streams: [{ name: "Tracking events", api: "17TRACK API · register/track", feeds: "Shipments", detail: "Container/parcel milestones + status" }],
    howto: ["Sign in to the 17TRACK dashboard → API.", "Copy your API key.", "Paste it below."],
  },
  {
    id: "quickbooks", name: "QuickBooks Online", tone: "success",
    blurb: "Syncs supplier bills, landed cost and partner draws to your books — so year-end tax and the pass-through split come straight from real accounting.",
    syncs: "Invoices · bills · COGS · partner draws",
    creds: OAUTH,
    streams: [
      { name: "Bills & COGS", api: "QBO API · bills", feeds: "Finance", detail: "Supplier bills + landed cost" },
      { name: "Partner draws", api: "QBO API · journal", feeds: "Finance · Partnership", detail: "Owner distributions" },
    ],
    howto: ["Create an app at Intuit Developer.", "Copy the OAuth Client ID & Secret.", "Authorize on your QuickBooks company to get a Refresh token.", "Paste the values below."],
  },
  {
    id: "wise", name: "FX rates (Wise)", tone: "info",
    blurb: "Pulls the live USD↔RMB rate so supplier costs paid in RMB land in USD exactly, and FX gain/loss is tracked against the rate at order time.",
    syncs: "Live USD ↔ RMB rate · payment FX",
    creds: [{ name: "api_token", label: "API token", type: "password" }],
    streams: [{ name: "USD↔RMB rate", api: "Wise API · rates", feeds: "Finance · P&L", detail: "Live rate for supplier costs" }],
    howto: ["Open Wise → Settings → API tokens.", "Create a token with read access.", "Paste it below."],
  },
];

export const INTG_STATUS_TONE: Record<string, "success" | "danger" | "warning" | "muted"> = {
  connected: "success", error: "danger", syncing: "warning", disconnected: "muted",
};
export const INTG_STATUS_LABEL: Record<string, string> = {
  connected: "Connected", error: "Action needed", syncing: "Syncing…", disconnected: "Not connected",
};

export function intgAgo(ts: string | null) {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
