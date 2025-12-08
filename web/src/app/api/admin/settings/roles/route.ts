import { NextRequest, NextResponse } from "next/server";

import { createClient, createServiceRoleClient } from "@/utils/supabase/server";

type ProfileRow = {
  id: string;
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

async function getAdminServerClient() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { supabase, session };
}

export async function GET() {
  const auth = await getAdminServerClient();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const { data, error } = await adminSupabase
    .from("profiles")
    .select("id, first_name, middle_initial, last_name, email, phone, role")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: (data ?? []) as ProfileRow[] });
}

export async function POST(req: NextRequest) {
  const auth = await getAdminServerClient();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const adminSupabase = createServiceRoleClient() ?? supabase;

  const body = await req.json().catch(() => null);
  const { userId, role } = body ?? {};

  if (!userId || !role) {
    return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
  }

  if (!["admin", "client"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { error } = await adminSupabase.from("profiles").update({ role }).eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
