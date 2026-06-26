"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { track17Register, track17Get, map17ToStage, type Track17Event } from "@/lib/track17";

type Result = { ok: true; id?: string } | { ok: false; error: string };
type Stage = Database["public"]["Enums"]["shipment_stage"];
type Customs = Database["public"]["Enums"]["customs_status"];
const STAGES: Stage[] = ["Draft", "Booked", "Picked up", "In transit", "Customs", "Delivered", "At FBA"];
const CUSTOMS: Customs[] = ["Cleared", "In clearance", "Pending", "Docs missing"];
const asStage = (v: string): Stage => (STAGES as string[]).includes(v) ? (v as Stage) : "Draft";
const asCustoms = (v: string): Customs | null => (CUSTOMS as string[]).includes(v) ? (v as Customs) : null;

const txt = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
const numOrNull = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const intOr0 = (v: FormDataEntryValue | null) => { const n = parseInt(String(v ?? "")); return Number.isFinite(n) ? n : 0; };

function fields(form: FormData) {
  return {
    order_id: txt(form.get("order_id")),
    order_title: txt(form.get("order_title")),
    supplier: txt(form.get("supplier")),
    mode: String(form.get("mode") ?? "Sea LCL").trim() || "Sea LCL",
    forwarder: txt(form.get("forwarder")),
    incoterm: txt(form.get("incoterm")),
    origin: txt(form.get("origin")),
    destination: txt(form.get("destination")),
    etd: txt(form.get("etd")),
    eta: txt(form.get("eta")),
    bol: txt(form.get("bol")),
    stage: asStage(String(form.get("stage") ?? "Draft")),
    customs: asCustoms(String(form.get("customs") ?? "")),
    cbm: numOrNull(form.get("cbm")),
    gross_kg: numOrNull(form.get("gross_kg")),
    cartons: numOrNull(form.get("cartons")),
    packed: intOr0(form.get("packed")),
    freight_usd: numOrNull(form.get("freight_usd")),
    broker: txt(form.get("broker")),
    duties_usd: numOrNull(form.get("duties_usd")),
  };
}

export async function createShipment(form: FormData): Promise<Result> {
  const supabase = await createClient();
  const f = fields(form);
  if (!f.mode) return { ok: false, error: "Mode is required." };
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const id = `SHP-${yymm}-${(Date.now() % 1000).toString().padStart(3, "0")}`;
  const { error } = await supabase.from("shipments").insert({ id, ...f });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  return { ok: true, id };
}

export async function updateShipment(id: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("shipments").update(fields(form)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  return { ok: true, id };
}

// Delete — blocked while FBA inbounds are linked to this shipment (archive instead).
export async function deleteShipment(id: string): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase.from("fba_inbounds").select("id", { count: "exact", head: true }).eq("shipment_id", id);
  if (count && count > 0) return { ok: false, error: `${count} FBA inbound${count > 1 ? "s are" : " is"} linked to this shipment — unlink or archive it instead of deleting.` };
  const { error } = await supabase.from("shipments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  return { ok: true };
}

export async function setShipmentArchived(id: string, archived: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("shipments").update({ archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  return { ok: true };
}

// Manual milestone bump (demo / when 17TRACK isn't connected) — moves the stage forward one step.
export async function advanceShipmentStage(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: s } = await supabase.from("shipments").select("stage").eq("id", id).maybeSingle();
  if (!s) return { ok: false, error: "Shipment not found." };
  const idx = STAGES.indexOf(s.stage as Stage);
  if (idx < 0 || idx >= STAGES.length - 1) return { ok: true, id };
  const { error } = await supabase.from("shipments").update({ stage: STAGES[idx + 1] }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  return { ok: true, id };
}

// Pull live milestones from 17TRACK for this shipment's tracking number.
export async function syncShipmentTracking(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: trk } = await supabase.from("shipment_tracking").select("tracking_no").eq("shipment_id", id).maybeSingle();
  if (!trk?.tracking_no) return { ok: false, error: "Add a tracking number first." };
  const { data: intg } = await supabase.from("integrations").select("status, oauth_token").eq("id", "track17").maybeSingle();
  const apiKey = (intg?.oauth_token as Record<string, string> | null)?.api_key;
  if (intg?.status !== "connected" || !apiKey) return { ok: false, error: "Connect 17TRACK in Integrations first." };

  try {
    await track17Register(apiKey, trk.tracking_no).catch(() => {}); // idempotent
    const res = await track17Get(apiKey, trk.tracking_no);
    if (!res) return { ok: false, error: "17TRACK has no data for this number yet." };
    await supabase.from("shipment_tracking").update({
      status: res.status, sub_status: res.subStatus,
      carrier: res.carrier ?? undefined,
      checkpoints: res.events as unknown as Database["public"]["Tables"]["shipment_tracking"]["Update"]["checkpoints"],
      last_sync: new Date().toISOString(),
    }).eq("shipment_id", id);
    // bump the freight stage forward if 17TRACK is further along
    const mapped = map17ToStage(res.status, res.subStatus);
    if (mapped) {
      const { data: s } = await supabase.from("shipments").select("stage").eq("id", id).maybeSingle();
      if (s && STAGES.indexOf(mapped as Stage) > STAGES.indexOf(s.stage as Stage)) {
        await supabase.from("shipments").update({ stage: mapped as Stage }).eq("id", id);
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "17TRACK sync failed." };
  }
  revalidatePath("/shipments");
  revalidatePath(`/shipments/${id}`);
  return { ok: true, id };
}

export type { Track17Event };

// Manual tracking (17TRACK not wired) — keep the forwarder-leg IDs on the shipment.
export async function updateTracking(shipmentId: string, form: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("shipment_tracking").upsert({
    shipment_id: shipmentId,
    tracking_no: txt(form.get("tracking_no")),
    booking_ref: txt(form.get("booking_ref")),
    carrier: txt(form.get("carrier")),
    scac: txt(form.get("scac")),
  }, { onConflict: "shipment_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  return { ok: true };
}
