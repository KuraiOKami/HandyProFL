import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import BookingDetailView from "@/components/client/BookingDetailView";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Supabase not configured.</p>
        </div>
      </div>
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/auth?redirect=/dashboard/booking/${id}`);
  }

  // Fetch the booking
  const { data: bookingRow, error } = await supabase
    .from("service_requests")
    .select(`
      id,
      service_type,
      preferred_date,
      preferred_time,
      details,
      status,
      created_at,
      total_price_cents,
      labor_price_cents,
      materials_cost_cents,
      assigned_agent_id,
      cancelled_at,
      cancellation_reason,
      cancellation_fee_cents
    `)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !bookingRow) {
    notFound();
  }

  // Calculate urgency/surcharge fee (total - labor - materials)
  const laborCents = bookingRow.labor_price_cents ?? 0;
  const materialsCents = bookingRow.materials_cost_cents ?? 0;
  const totalCents = bookingRow.total_price_cents ?? 0;
  const urgencyFeeCents = Math.max(0, totalCents - laborCents - materialsCents);

  const booking = {
    id: bookingRow.id,
    serviceType: bookingRow.service_type,
    preferredDate: bookingRow.preferred_date,
    preferredTime: bookingRow.preferred_time,
    details: bookingRow.details,
    status: bookingRow.status,
    createdAt: bookingRow.created_at,
    totalPriceCents: bookingRow.total_price_cents,
    laborPriceCents: bookingRow.labor_price_cents,
    materialsCostCents: bookingRow.materials_cost_cents,
    urgencyFeeCents: urgencyFeeCents > 0 ? urgencyFeeCents : null,
    street: null,
    city: null,
    state: null,
    postalCode: null,
    assignedAgentId: bookingRow.assigned_agent_id,
    cancelledAt: bookingRow.cancelled_at,
    cancellationReason: bookingRow.cancellation_reason,
    cancellationFeeCents: bookingRow.cancellation_fee_cents,
  };

  // Fetch agent info if assigned
  let agentProfile = null;
  if (booking.assignedAgentId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, email")
      .eq("id", booking.assignedAgentId)
      .single();

    const { data: agentData } = await supabase
      .from("agent_profiles")
      .select("photo_url, rating, total_jobs, tier")
      .eq("id", booking.assignedAgentId)
      .single();

    if (profile) {
      agentProfile = {
        ...profile,
        photo_url: agentData?.photo_url,
        rating: agentData?.rating,
        total_jobs: agentData?.total_jobs,
        tier: agentData?.tier || "bronze",
      };
    }
  }

  // Fetch job assignment status
  const { data: jobAssignment } = await supabase
    .from("job_assignments")
    .select("id, status, started_at, completed_at, notes")
    .eq("request_id", id)
    .single();

  // Fetch proof of work photos
  let proofPhotos: { id: string; type: string; photo_url: string; notes: string | null }[] = [];
  if (jobAssignment) {
    const { data: photos } = await supabase
      .from("proof_of_work")
      .select("id, type, photo_url, notes")
      .eq("assignment_id", jobAssignment.id)
      .order("created_at", { ascending: true });

    proofPhotos = photos || [];
  }

  return (
    <BookingDetailView
      booking={booking}
      agentProfile={agentProfile}
      jobAssignment={jobAssignment}
      proofPhotos={proofPhotos}
    />
  );
}
