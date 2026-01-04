# OAuth Provider Setup Guide

This guide explains how to enable Google and Apple OAuth login for HandyProFL.

## Prerequisites

- Supabase project with authentication enabled
- Access to Google Cloud Console (for Google OAuth)
- Apple Developer Account (for Apple OAuth)
- Your app's production URL (e.g., `https://handyprofl.netlify.app`)

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Google+ API" and "Google Identity" APIs

### Step 2: Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (unless you have Google Workspace)
3. Fill in the required fields:
   - App name: `HandyProFL`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `./auth/userinfo.email`
   - `./auth/userinfo.profile`
5. Add test users if in testing mode

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application**
4. Configure:
   - Name: `HandyProFL Web`
   - Authorized JavaScript origins:
     ```
     https://handyprofl.netlify.app
     http://localhost:3000
     ```
   - Authorized redirect URIs:
     ```
     https://<your-supabase-project>.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```
5. Copy the **Client ID** and **Client Secret**

### Step 4: Enable in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication > Providers**
3. Find **Google** and toggle it ON
4. Enter:
   - Client ID: (from Step 3)
   - Client Secret: (from Step 3)
5. Save

---

## Apple OAuth Setup

### Step 1: Register App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Under **Identifiers**, click **+** to add a new App ID
4. Select **App IDs** and click Continue
5. Configure:
   - Description: `HandyProFL`
   - Bundle ID: `com.handyprofl.web` (explicit)
6. Enable **Sign in with Apple** capability
7. Click Continue and Register

### Step 2: Create Services ID

1. Under **Identifiers**, click **+** again
2. Select **Services IDs** and click Continue
3. Configure:
   - Description: `HandyProFL Web`
   - Identifier: `com.handyprofl.web.signin`
4. Click Continue and Register
5. Click on the newly created Services ID
6. Enable **Sign in with Apple**
7. Click **Configure** next to Sign in with Apple
8. Add:
   - Primary App ID: Select your App ID from Step 1
   - Domains: `handyprofl.netlify.app` and `<your-supabase-project>.supabase.co`
   - Return URLs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
9. Save

### Step 3: Create Private Key

1. Under **Keys**, click **+** to add a new key
2. Name: `HandyProFL Sign In Key`
3. Enable **Sign in with Apple**
4. Click **Configure** and select your App ID
5. Click Continue, then Register
6. **Download the key file** (you can only download once!)
7. Note the **Key ID**

### Step 4: Get Team ID

1. In the Apple Developer Portal top-right, click on your account
2. Your **Team ID** is displayed in the Membership section

### Step 5: Enable in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication > Providers**
3. Find **Apple** and toggle it ON
4. Enter:
   - Client ID: `com.handyprofl.web.signin` (your Services ID)
   - Secret Key: (contents of the .p8 file you downloaded)
   - Key ID: (from Step 3)
   - Team ID: (from Step 4)
5. Save

---

## Environment Variables

No additional environment variables are needed in your Next.js app. OAuth is handled entirely by Supabase.

The existing auth callback at `/auth/callback` will handle both Google and Apple sign-ins.

---

## Testing

### Local Development

1. Ensure your Supabase project allows `http://localhost:3000` as a redirect URL
2. For Google: Add `http://localhost:3000` to authorized origins
3. For Apple: Testing locally requires HTTPS (use ngrok or similar)

### Production

1. Test sign-in flow at `https://handyprofl.netlify.app/auth`
2. Verify the callback redirects correctly
3. Check that user profiles are created in the `profiles` table

---

## Troubleshooting

### "redirect_uri_mismatch" (Google)
- Ensure the redirect URI in Google Console exactly matches Supabase's callback URL
- Check for trailing slashes

### "invalid_client" (Apple)
- Verify the Services ID matches exactly
- Ensure the private key hasn't expired
- Check Team ID and Key ID

### User not created in profiles table
- The auth callback should handle profile creation
- Check Supabase Functions logs for errors

---

## Code Reference

The authentication is handled in:
- `/src/app/auth/page.tsx` - Login UI with OAuth buttons
- `/src/app/auth/callback/route.ts` - OAuth callback handler

To add OAuth buttons (if not already present):

```tsx
// In your auth page
<button
  onClick={() => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })}
  className="w-full rounded-lg bg-white border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
>
  Continue with Google
</button>

<button
  onClick={() => supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })}
  className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-slate-800"
>
  Continue with Apple
</button>
```
