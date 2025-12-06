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
    return existing.customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  const { error: insertError } = await client
    .from('stripe_customers')
    .insert({ user_id: userId, customer_id: customer.id });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return customer.id;
}
