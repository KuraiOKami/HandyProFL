import twilio, { Twilio } from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

export const twilioClient: Twilio | null =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

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
