/**
 * Sends transactional email through Brevo's HTTPS API.
 *
 * It uses the built-in fetch on purpose: no SMTP client or native module, so it runs on Wasmer Edge.
 * Configuration comes from two environment variables (set them as Wasmer secrets):
 *   BREVO_API_KEY       - a Brevo API key with the "Transactional email" permission
 *   BREVO_SENDER_EMAIL  - a sender address verified in Brevo (Senders, Domains & Dedicated IPs)
 */

export class EmailSendError extends Error {}

export type OutgoingEmail = { to: string; subject: string; html: string; text?: string };

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_NAME = "Reading Room";
const TIMEOUT_MS = 10_000;

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new EmailSendError("Email is not configured on this server (BREVO_API_KEY is missing).");
    }
    // Local development only: print the message so the flow can be tested without a Brevo account.
    console.info(`[email:dev] To: ${message.to}\n[email:dev] Subject: ${message.subject}\n${message.text ?? message.html}`);
    return;
  }
  if (!senderEmail) throw new EmailSendError("Email is not configured on this server (BREVO_SENDER_EMAIL is missing).");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: senderEmail },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        ...(message.text ? { textContent: message.text } : {})
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      // Log only the status, never the key or the message body.
      console.error(`Brevo rejected an email (HTTP ${response.status}).`);
      throw new EmailSendError("The email could not be sent.");
    }
  } catch (error) {
    if (error instanceof EmailSendError) throw error;
    console.error("Brevo request failed:", error instanceof Error ? error.name : "unknown error");
    throw new EmailSendError("The email could not be sent.");
  } finally {
    clearTimeout(timer);
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

export function codeEmail(kind: "verify" | "reset", name: string, code: string, minutes: number): Omit<OutgoingEmail, "to"> {
  const heading = kind === "verify" ? "Verify your email" : "Reset your password";
  const intro = kind === "verify"
    ? "Use this code to finish creating your Reading Room account."
    : "Use this code to choose a new password for your Reading Room account.";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:Georgia,serif;color:#23332a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #dfd9c9;border-radius:8px">
<tr><td style="padding:28px 28px 8px"><div style="font-size:11px;letter-spacing:2px;color:#3b6b4a">READING ROOM</div>
<h1 style="margin:8px 0 0;font-size:24px;font-weight:500">${heading}</h1></td></tr>
<tr><td style="padding:8px 28px;font-size:15px;line-height:1.5">Hello ${escapeHtml(name)},<br>${intro}</td></tr>
<tr><td align="center" style="padding:12px 28px"><div style="font-size:34px;letter-spacing:10px;font-weight:700;padding:14px 0;background:#f6f3ec;border-radius:6px">${code}</div></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:13px;color:#5d6b60;line-height:1.5">This code expires in ${minutes} minutes and works once. If you did not ask for it, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Reading Room\n\n${heading}\n${intro}\n\nYour code: ${code}\n\nIt expires in ${minutes} minutes. If you did not ask for it, ignore this email.`;
  return { subject: `${heading} - Reading Room`, html, text };
}
