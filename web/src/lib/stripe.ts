import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn('Missing STRIPE_SECRET_KEY. Stripe calls will fail until it is set.');
}

export const stripe =
  secretKey != null && secretKey !== ''
    ? new Stripe(secretKey, {
        apiVersion: '2024-12-18',
      })
    : null;
