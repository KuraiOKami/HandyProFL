import { stripe } from '@/lib/stripe';
import { createClient, createServiceRoleClient } from '@/utils/supabase/server';

type CustomerRow = { user_id: string; customer_id: string };

export async function getOrCreateCustomer(userId: string, email?: string) {
  if (!stripe) throw new Error('Stripe not configured');

  // Prefer service role, but fall back to user-scoped client if service role is missing.
  const admin = createServiceRoleClient();
  const fallbackClient = !admin ? await createClient() : null;
  const client = admin ?? fallbackClient;

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data: existing, error: selectError } = await client
    .from('stripe_customers')
    .select('user_id, customer_id')
    .eq('user_id', userId)
    .maybeSingle<CustomerRow>();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing?.customer_id) {
    try {
      // Validate the customer still exists in Stripe (handles test/live swaps).
      await stripe.customers.retrieve(existing.customer_id);
      return existing.customer_id;
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((e as any).code as string | undefined)
          : undefined;
      const isMissing = code === 'resource_missing';
      if (!isMissing) throw e;
      // fall through to create a fresh customer
    }
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  const { error: upsertError } = await client
    .from('stripe_customers')
    .upsert({ user_id: userId, customer_id: customer.id }, { onConflict: 'user_id' });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return customer.id;
}
