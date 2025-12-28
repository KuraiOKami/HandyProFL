import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { notifyAgentNewMessage, notifyClientNewMessage } from "@/lib/notifications";

async function getAuthenticatedUser() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name")
    .eq("id", session.user.id)
    .single();

  return { supabase, session, profile, adminSupabase: createServiceRoleClient() ?? supabase };
}

// Verify user has access to this job's messages
async function verifyJobAccess(
  adminSupabase: ReturnType<typeof createServiceRoleClient>,
  jobId: string,
  userId: string
): Promise<{ hasAccess: boolean; isAgent: boolean; otherPartyId: string | null; serviceName: string | null }> {
  if (!adminSupabase) {
    return { hasAccess: false, isAgent: false, otherPartyId: null, serviceName: null };
  }

  const { data: assignment } = await adminSupabase
    .from("job_assignments")
    .select(`
      id,
      agent_id,
      service_requests (
        id,
        user_id,
        service_type
      )
    `)
    .eq("id", jobId)
    .single();

  if (!assignment) {
    return { hasAccess: false, isAgent: false, otherPartyId: null, serviceName: null };
  }

  const sr = Array.isArray(assignment.service_requests)
    ? assignment.service_requests[0]
    : assignment.service_requests;

  const isAgent = assignment.agent_id === userId;
  const isClient = sr?.user_id === userId;

  if (!isAgent && !isClient) {
    return { hasAccess: false, isAgent: false, otherPartyId: null, serviceName: null };
  }

  // Get service name for notifications
  let serviceName: string | null = null;
  if (sr?.service_type) {
    const { data: service } = await adminSupabase
      .from("service_catalog")
      .select("name")
      .eq("id", sr.service_type)
      .single();
    serviceName = service?.name || sr.service_type;
  }

  return {
    hasAccess: true,
    isAgent,
    otherPartyId: isAgent ? sr?.user_id || null : assignment.agent_id,
    serviceName,
  };
}

// GET: Fetch messages for a job
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth.error;
  const { session, adminSupabase } = auth;

  const { jobId } = await params;

  // Verify access
  const access = await verifyJobAccess(adminSupabase, jobId, session.user.id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Get messages
  const { data: messages, error } = await adminSupabase
    .from("messages")
    .select(`
      id,
      sender_id,
      sender_role,
      content,
      read_at,
      created_at
    `)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark unread messages from the other party as read
  const unreadFromOther = (messages || [])
    .filter((m) => m.sender_id !== session.user.id && !m.read_at)
    .map((m) => m.id);

  if (unreadFromOther.length > 0) {
    await adminSupabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadFromOther);
  }

  // Get sender names for display
  const senderIds = [...new Set((messages || []).map((m) => m.sender_id))];
  const { data: senders } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", senderIds);

  const senderMap = new Map(
    (senders || []).map((s) => [
      s.id,
      [s.first_name, s.last_name].filter(Boolean).join(" ") || "User",
    ])
  );

  const enrichedMessages = (messages || []).map((m) => ({
    ...m,
    sender_name: senderMap.get(m.sender_id) || "User",
    is_own: m.sender_id === session.user.id,
  }));

  return NextResponse.json({
    messages: enrichedMessages,
    is_agent: access.isAgent,
  });
}

// POST: Send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth.error;
  const { session, profile, adminSupabase } = auth;

  const { jobId } = await params;

  const body = await req.json().catch(() => null);
  const content = body?.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  if (content.length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });
  }

  // Verify access
  const access = await verifyJobAccess(adminSupabase, jobId, session.user.id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Insert message
  const { data: message, error } = await adminSupabase
    .from("messages")
    .insert({
      job_id: jobId,
      sender_id: session.user.id,
      sender_role: access.isAgent ? "agent" : "client",
      content,
    })
    .select("id, sender_id, sender_role, content, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send notification to the other party
  if (access.otherPartyId) {
    try {
      const senderName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Someone";
      const preview = content.length > 50 ? content.substring(0, 50) + "..." : content;

      if (access.isAgent) {
        // Agent sent message, notify client
        // Get request ID for the link
        const { data: assignment } = await adminSupabase
          .from("job_assignments")
          .select("request_id")
          .eq("id", jobId)
          .single();

        if (assignment?.request_id) {
          await notifyClientNewMessage(adminSupabase, access.otherPartyId, {
            agentName: senderName,
            requestId: assignment.request_id,
            messagePreview: preview,
          });
        }
      } else {
        // Client sent message, notify agent
        await notifyAgentNewMessage(adminSupabase, access.otherPartyId, {
          clientName: senderName,
          jobId,
          messagePreview: preview,
        });
      }
    } catch (notifyErr) {
      console.warn("Failed to send new message notification:", notifyErr);
    }
  }

  return NextResponse.json({
    ok: true,
    message: {
      ...message,
      is_own: true,
      sender_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "You",
    },
  });
}
