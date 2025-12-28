import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | HandyPro FL',
  description: 'Privacy policy for HandyPro FL handyman services.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: December 28, 2024</p>

          <div className="mt-8 space-y-6 text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">1. Introduction</h2>
              <p className="mt-2">
                HandyPro FL (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use our
                handyman services platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">2. Information We Collect</h2>
              <p className="mt-2">We collect information you provide directly to us, including:</p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li><strong>Account Information:</strong> Name, email address, phone number, and password</li>
                <li><strong>Profile Information:</strong> Address, service preferences, and payment methods</li>
                <li><strong>Service Request Information:</strong> Details about requested services, scheduling preferences, photos, and special instructions</li>
                <li><strong>Payment Information:</strong> Credit card details (processed securely through Stripe)</li>
                <li><strong>Communications:</strong> Messages between you and service providers, customer support inquiries</li>
              </ul>
              <p className="mt-3">We automatically collect:</p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Device information and browser type</li>
                <li>IP address and location data</li>
                <li>Usage data and interaction with our services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">3. How We Use Your Information</h2>
              <p className="mt-2">We use the information we collect to:</p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Match you with qualified service providers</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Send booking confirmations, reminders, and status updates via SMS and email</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">4. Information Sharing</h2>
              <p className="mt-2">We may share your information with:</p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li><strong>Service Providers:</strong> We share relevant booking details with assigned handyman professionals to complete your service requests</li>
                <li><strong>Payment Processors:</strong> Stripe processes all payment transactions securely</li>
                <li><strong>Communication Services:</strong> Twilio powers our SMS notifications</li>
                <li><strong>Analytics Providers:</strong> To help us understand usage patterns</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              </ul>
              <p className="mt-3">
                We do not sell, rent, or share your personal information with third parties for their marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">5. Data Security</h2>
              <p className="mt-2">
                We implement appropriate technical and organizational measures to protect your personal information,
                including:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication methods</li>
                <li>Regular security assessments</li>
                <li>Limited access to personal information on a need-to-know basis</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">6. Your Rights and Choices</h2>
              <p className="mt-2">You have the right to:</p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Access, update, or delete your personal information</li>
                <li>Opt out of SMS messages by replying STOP</li>
                <li>Opt out of marketing emails by clicking unsubscribe</li>
                <li>Request a copy of your data</li>
                <li>Close your account at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">7. Data Retention</h2>
              <p className="mt-2">
                We retain your personal information for as long as your account is active or as needed to provide
                you services. We may retain certain information as required by law or for legitimate business purposes,
                such as resolving disputes and enforcing our agreements.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">8. Children&apos;s Privacy</h2>
              <p className="mt-2">
                Our services are not intended for individuals under 18 years of age. We do not knowingly collect
                personal information from children.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">9. Changes to This Policy</h2>
              <p className="mt-2">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting
                the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">10. Contact Us</h2>
              <p className="mt-2">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Email: support@handyprofl.com</li>
                <li>Website: handyprofl.netlify.app</li>
              </ul>
            </section>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-sm text-slate-500">
              By using HandyPro FL, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
