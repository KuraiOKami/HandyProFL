import { stripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/utils/supabase/server';

type CustomerRow = { user_id: string; customer_id: string };

export async function getOrCreateCustomer(userId: string, email?: string) {
  if (!stripe) throw new Error('Stripe not configured');

  const admin = createServiceRoleClient();
  if (!admin) {
    throw new Error('Supabase service role not configured');
  }

  const { data: existing, error: selectError } = await admin
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

  const { error: insertError } = await admin
    .from('stripe_customers')
    .insert({ user_id: userId, customer_id: customer.id });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return customer.id;
}
