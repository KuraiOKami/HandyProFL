import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

type Params = { params: Promise<{ id: string }> };

function computeCancellationFee(preferredTime: string | null, preferredDate: string | null) {
  let serviceDate: Date | null = null;

  if (preferredTime) {
    const d = new Date(preferredTime);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate && preferredDate) {
    const d = new Date(`${preferredDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) serviceDate = d;
  }

  if (!serviceDate) return 0;

  const diffHours = (serviceDate.getTime() - Date.now()) / (1000 * 60 * 60);

  if (diffHours <= 2) return 4000; // $40 within 2 hours
  if (diffHours <= 24) return 1000; // $10 within 24 hours
  return 0; // free beyond 24 hours
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const reason = (body?.reason as string | undefined)?.trim() || null;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data: requestRow, error: requestError } = await adminSupabase
    .from("service_requests")
    .select("id, user_id, status, preferred_time, preferred_date")
    .eq("id", (await params).id)
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Check permissions: owner or admin
  if (requestRow.user_id !== session.user.id) {
    const { data: profile } = await adminSupabase.from("profiles").select("role").eq("id", session.user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (requestRow.status === "cancelled" || requestRow.status === "complete" || requestRow.status === "completed") {
    return NextResponse.json({ error: "Request is already closed" }, { status: 400 });
  }

  const feeCents = computeCancellationFee(requestRow.preferred_time, requestRow.preferred_date);
  const cancelledAt = new Date().toISOString();

  const { error: updateError } = await adminSupabase
    .from("service_requests")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_fee_cents: feeCents,
      cancelled_at: cancelledAt,
    })
    .eq("id", requestRow.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If there was a reserved slot, release it
  if (requestRow.preferred_time) {
    await adminSupabase.from("available_slots").update({ is_booked: false }).eq("slot_start", requestRow.preferred_time);
  }

  // Cancel any job assignment if present
  await adminSupabase
    .from("job_assignments")
    .update({ status: "cancelled", cancellation_reason: reason ?? "Cancelled by user" })
    .eq("request_id", requestRow.id);

  return NextResponse.json({
    status: "cancelled",
    fee_cents: feeCents,
    cancelled_at: cancelledAt,
  });
}
