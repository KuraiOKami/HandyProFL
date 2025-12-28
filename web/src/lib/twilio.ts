import twilio, { Twilio } from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

// Only initialize Twilio client if credentials are properly formatted
// Account SID must start with "AC"
const isValidCredentials =
  accountSid &&
  authToken &&
  accountSid.startsWith("AC") &&
  accountSid.length > 2 &&
  authToken.length > 0;

let twilioClient: Twilio | null = null;
try {
  if (isValidCredentials) {
    twilioClient = twilio(accountSid, authToken);
  }
} catch (err) {
  console.warn("Failed to initialize Twilio client:", err);
}

export { twilioClient };
export const twilioConfigured = Boolean(twilioClient && fromNumber);

export async function sendSms(to: string, body: string) {
  if (!twilioClient || !fromNumber) {
    throw new Error("Twilio not configured");
  }

  return twilioClient.messages.create({
    to,
    from: fromNumber,
    body,
  });
}
