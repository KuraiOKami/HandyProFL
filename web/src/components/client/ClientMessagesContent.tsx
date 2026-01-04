'use client';

import { useEffect, useState } from 'react';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { getSupabaseClient } from '@/lib/supabaseClient';
import Link from 'next/link';

type Conversation = {
  id: string;
  booking_id: string;
  agent_name: string;
  service_type: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

export default function ClientMessagesContent() {
  const { session } = useSupabaseSession();
  const supabase = getSupabaseClient();

  const [conversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversations = async () => {
      if (!session || !supabase) {
        setLoading(false);
        return;
      }

      // For now, we'll show a placeholder since messages table doesn't exist yet
      // In a real implementation, you'd fetch from a messages/conversations table
      setLoading(false);
    };

    loadConversations();
  }, [session, supabase]);

  if (!session) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Please sign in to view your messages.</p>
        <Link
          href="/auth?redirect=/dashboard?tab=messages"
          className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700"></div>
          <p className="text-sm text-slate-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  // Empty state / Coming soon
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="mb-4 text-5xl">💬</div>
        <h3 className="text-xl font-semibold text-slate-900">Messages Coming Soon</h3>
        <p className="mt-2 text-slate-600">
          Soon you&apos;ll be able to chat directly with your assigned agent about your booking.
        </p>
        <div className="mt-6 rounded-lg bg-indigo-50 p-4 text-left">
          <h4 className="font-medium text-indigo-900">What&apos;s Coming:</h4>
          <ul className="mt-2 space-y-2 text-sm text-indigo-800">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">-</span>
              <span>Real-time chat with your assigned agent</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">-</span>
              <span>Share photos and details about your job</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">-</span>
              <span>Get updates when the agent is on the way</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-500">-</span>
              <span>Coordinate scheduling changes</span>
            </li>
          </ul>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          In the meantime, you can contact us at{' '}
          <a href="mailto:support@handyprofl.com" className="font-medium text-indigo-600 hover:underline">
            support@handyprofl.com
          </a>
        </p>
      </div>

      {/* Placeholder for future conversation list */}
      {conversations.length > 0 && (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/dashboard/messages/${conv.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{conv.agent_name}</p>
                  <p className="text-sm text-slate-500">{conv.service_type}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600 line-clamp-1">{conv.last_message}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(conv.last_message_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
