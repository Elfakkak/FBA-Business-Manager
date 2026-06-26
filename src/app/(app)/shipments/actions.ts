"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

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

export async function deleteShipment(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("shipments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  return { ok: true };
}

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
