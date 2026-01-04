import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { notifyAdmins } from "@/lib/adminNotifications";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const firstName = (body?.first_name as string | undefined)?.trim();
  const lastName = (body?.last_name as string | undefined)?.trim();
  const phone = (body?.phone as string | undefined)?.trim() || null;
  const email = (body?.email as string | undefined)?.trim() || session.user.email || null;
  const street = (body?.street as string | undefined)?.trim() || null;
  const city = (body?.city as string | undefined)?.trim() || null;
  const state = (body?.state as string | undefined)?.trim() || null;
  const postalCode = (body?.postal_code as string | undefined)?.trim() || null;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data: existingProfile } = await adminSupabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", session.user.id)
    .maybeSingle();

  const isNewProfile = !(existingProfile?.first_name && existingProfile?.last_name);

  const { error: upsertError } = await adminSupabase.from("profiles").upsert(
    {
      id: session.user.id,
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      street,
      city,
      state,
      postal_code: postalCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  if (isNewProfile) {
    const messageLines = [
      `New client signup: ${firstName} ${lastName}.`,
      `Email: ${email || "Not provided"}.`,
      `Phone: ${phone || "Not provided"}.`,
    ];

    await notifyAdmins(adminSupabase, {
      subject: "New client signup",
      message: messageLines.join("\n"),
      sms: `New client: ${firstName} ${lastName}.`,
    });
  }

  return NextResponse.json({ ok: true });
}
