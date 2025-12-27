type SendEmailOptions = {
  to: string[] | string;
  subject: string;
  text: string;
  html?: string;
};

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resendFromName = process.env.RESEND_FROM_NAME || "HandyProFL";

export const resendConfigured = Boolean(resendApiKey && resendFromEmail);

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  if (!resendApiKey || !resendFromEmail) {
    throw new Error("Resend not configured");
  }

  const from = resendFromName
    ? `${resendFromName} <${resendFromEmail}>`
    : resendFromEmail;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Resend error: ${errorText}`);
  }

  return res.json();
}
