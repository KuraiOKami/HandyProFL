import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions | HandyPro FL',
  description: 'Terms and conditions for using HandyPro FL handyman services.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Terms & Conditions</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: December 28, 2024</p>

          <div className="mt-8 space-y-6 text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of Terms</h2>
              <p className="mt-2">
                By accessing or using HandyPro FL (&quot;Service&quot;), you agree to be bound by these Terms & Conditions.
                If you do not agree to these terms, please do not use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">2. Description of Service</h2>
              <p className="mt-2">
                HandyPro FL is a platform that connects customers with independent handyman professionals
                (&quot;Service Providers&quot;) for various home repair and improvement services in Florida.
                We facilitate bookings, payments, and communications between customers and Service Providers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">3. User Accounts</h2>
              <p className="mt-2">To use our Service, you must:</p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Be at least 18 years old</li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Promptly update any changes to your information</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">4. Booking and Payment</h2>
              <ul className="mt-2 list-disc pl-6 space-y-2">
                <li>
                  <strong>Pricing:</strong> Service prices are displayed before booking. Prices include labor
                  and may include materials. Urgency fees apply for same-day, next-day, and 2-day bookings.
                </li>
                <li>
                  <strong>Payment:</strong> Payment is processed when a Service Provider confirms your booking.
                  We use Stripe for secure payment processing.
                </li>
                <li>
                  <strong>Cancellation:</strong> You may cancel a booking before it is confirmed at no charge.
                  Cancellations after confirmation may be subject to a cancellation fee as disclosed at
                  the time of cancellation.
                </li>
                <li>
                  <strong>Refunds:</strong> Refunds are processed on a case-by-case basis. If a service is
                  not completed satisfactorily, please contact support.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">5. Service Provider Relationship</h2>
              <p className="mt-2">
                Service Providers are independent contractors, not employees of HandyPro FL. We do not:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Employ, supervise, or control Service Providers</li>
                <li>Guarantee the quality, timing, or completion of any service</li>
                <li>Provide tools, equipment, or materials used by Service Providers</li>
              </ul>
              <p className="mt-3">
                We do verify Service Provider identities and qualifications, but customers should exercise
                their own judgment when using services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">6. User Conduct</h2>
              <p className="mt-2">You agree not to:</p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Use the Service for any unlawful purpose</li>
                <li>Harass, abuse, or harm Service Providers or other users</li>
                <li>Provide false or misleading information</li>
                <li>Circumvent payment through the platform</li>
                <li>Copy, modify, or distribute our content without permission</li>
                <li>Interfere with the proper functioning of the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">7. Limitation of Liability</h2>
              <p className="mt-2">
                To the maximum extent permitted by law, HandyPro FL shall not be liable for:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Any indirect, incidental, special, or consequential damages</li>
                <li>Property damage or personal injury resulting from services performed</li>
                <li>Actions or omissions of Service Providers</li>
                <li>Service interruptions or technical issues</li>
                <li>Loss of data or unauthorized access to your account</li>
              </ul>
              <p className="mt-3">
                Our total liability shall not exceed the amount you paid for the specific service giving
                rise to the claim.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">8. Indemnification</h2>
              <p className="mt-2">
                You agree to indemnify and hold harmless HandyPro FL, its officers, directors, employees,
                and agents from any claims, damages, losses, or expenses arising from your use of the Service
                or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">9. Intellectual Property</h2>
              <p className="mt-2">
                All content, trademarks, and intellectual property on the Service are owned by HandyPro FL
                or its licensors. You may not use, copy, or distribute this content without our written permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">10. Dispute Resolution</h2>
              <p className="mt-2">
                Any disputes arising from these Terms or your use of the Service shall be resolved through
                binding arbitration in Florida, in accordance with the rules of the American Arbitration
                Association. You waive any right to participate in class action lawsuits.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">11. Termination</h2>
              <p className="mt-2">
                We may suspend or terminate your account at any time for violation of these Terms or for
                any other reason at our discretion. Upon termination, your right to use the Service ceases
                immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">12. Changes to Terms</h2>
              <p className="mt-2">
                We reserve the right to modify these Terms at any time. We will notify you of significant
                changes by posting a notice on our website or sending you an email. Continued use of the
                Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">13. Governing Law</h2>
              <p className="mt-2">
                These Terms are governed by the laws of the State of Florida, without regard to conflict
                of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">14. Contact Information</h2>
              <p className="mt-2">
                For questions about these Terms, please contact us at:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1">
                <li>Email: support@handyprofl.com</li>
                <li>Website: handyprofl.netlify.app</li>
              </ul>
            </section>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-sm text-slate-500">
              By using HandyPro FL, you acknowledge that you have read, understood, and agree to be bound
              by these Terms & Conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
