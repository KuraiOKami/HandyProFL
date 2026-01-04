import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Terms & Consent | HandyPro FL',
  description: 'SMS messaging terms and consent policy for HandyPro FL services.',
};

export default function SMSTermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">SMS Terms & Consent</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: December 28, 2024</p>

          <div className="mt-8 space-y-6 text-slate-700">
            <section className="rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
              <h2 className="text-lg font-semibold text-indigo-900">Important Notice About SMS Consent</h2>
              <p className="mt-2 text-indigo-800">
                By checking the SMS consent box on our signup or booking forms and submitting your phone number,
                you expressly agree to receive SMS text messages from HandyPro FL as described below. Consent to
                receive SMS messages is not a condition of purchase.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">1. Consent to Receive SMS Messages</h2>
              <p className="mt-2">
                When you check the SMS consent box and provide your phone number, you expressly consent to receive
                SMS text messages from HandyPro FL at the phone number you provided. These messages may include:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>One-time verification codes (OTP) for account authentication</li>
                <li>Booking confirmations and updates</li>
                <li>Appointment reminders</li>
                <li>Service provider assignment notifications</li>
                <li>Job status updates (started, completed)</li>
                <li>Payment confirmations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">2. Message Frequency</h2>
              <p className="mt-2">
                Message frequency varies based on your activity. You may receive multiple messages when:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Logging in or verifying your account</li>
                <li>Booking a service</li>
                <li>A service provider is assigned to your booking</li>
                <li>Your scheduled service is approaching</li>
                <li>Your service is being performed or completed</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">3. Message and Data Rates</h2>
              <p className="mt-2">
                Standard message and data rates may apply. Please contact your wireless carrier for details
                about your messaging plan. HandyPro FL does not charge for SMS messages, but your carrier may.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">4. Opting Out</h2>
              <p className="mt-2">
                You can opt out of receiving SMS messages at any time by:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Replying <strong>STOP</strong> to any message you receive from us</li>
                <li>Contacting us at support@handyprofl.com</li>
              </ul>
              <p className="mt-3">
                After opting out, you will receive one final confirmation message. Note that opting out of
                SMS messages may affect your ability to use certain features like phone-based login.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">5. Help</h2>
              <p className="mt-2">
                For help with SMS messages, reply <strong>HELP</strong> to any message or contact us at:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Email: support@handyprofl.com</li>
                <li>Website: handyprofl.netlify.app</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">6. Privacy</h2>
              <p className="mt-2">
                Your phone number and messaging data are handled in accordance with our Privacy Policy.
                We do not sell, rent, or share your phone number with third parties for marketing purposes.
                Your phone number is only used for:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Account verification and security</li>
                <li>Service-related communications</li>
                <li>Connecting you with assigned service providers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">7. Supported Carriers</h2>
              <p className="mt-2">
                SMS messages are supported on most major US carriers including AT&T, Verizon, T-Mobile,
                Sprint, and others. Carrier support may vary.
              </p>
            </section>

            <section className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Sample Messages</h2>
              <p className="mt-2 text-sm">Examples of messages you may receive:</p>
              <div className="mt-3 space-y-2 font-mono text-sm">
                <div className="rounded bg-white p-3 border border-slate-200">
                  &quot;Your HandyPro FL verification code is: 123456. This code expires in 10 minutes.&quot;
                </div>
                <div className="rounded bg-white p-3 border border-slate-200">
                  &quot;HandyPro FL: Your TV Mounting booking for Dec 30 at 9:00 AM has been confirmed. Reply STOP to unsubscribe.&quot;
                </div>
                <div className="rounded bg-white p-3 border border-slate-200">
                  &quot;HandyPro FL: John D. has been assigned to your booking and will arrive at 9:00 AM. Reply STOP to opt out.&quot;
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-sm text-slate-500">
              By using HandyPro FL and providing your phone number, you acknowledge that you have read and
              agree to these SMS Terms & Consent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
