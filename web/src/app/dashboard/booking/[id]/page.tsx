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
  const { data: booking, error } = await supabase
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
      street,
      city,
      state,
      postal_code,
      assigned_agent_id,
      cancelled_at,
      cancellation_reason,
      cancellation_fee_cents
    `)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !booking) {
    notFound();
  }

  // Fetch agent info if assigned
  let agentProfile = null;
  if (booking.assigned_agent_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, email")
      .eq("id", booking.assigned_agent_id)
      .single();

    const { data: agentData } = await supabase
      .from("agent_profiles")
      .select("photo_url, rating, total_jobs")
      .eq("id", booking.assigned_agent_id)
      .single();

    if (profile) {
      agentProfile = {
        ...profile,
        photo_url: agentData?.photo_url,
        rating: agentData?.rating,
        total_jobs: agentData?.total_jobs,
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
