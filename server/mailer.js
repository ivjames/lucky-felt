// Email delivery for sign-in codes.
//
// Provider-agnostic: configure SMTP via env (SMTP_URL, or SMTP_HOST/PORT/USER/
// PASS) and nodemailer handles delivery. With nothing configured, we fall back
// to logging the code server-side so local dev works without a mail provider.

let transporterPromise = null;

function buildTransport() {
  if (process.env.SMTP_URL) return process.env.SMTP_URL;
  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    };
  }
  return null;
}

function getTransporter() {
  const cfg = buildTransport();
  if (!cfg) return null;
  if (!transporterPromise) {
    transporterPromise = import("nodemailer").then((nm) => nm.default.createTransport(cfg));
  }
  return transporterPromise;
}

export function mailerConfigured() {
  return buildTransport() !== null;
}

// Sends the one-time code. Returns { delivered } — false means we only logged it
// (no transport configured), which the caller surfaces in dev.
export async function sendLoginCode(email, code) {
  const from = process.env.MAIL_FROM || "Lucky Felt Casino <no-reply@casino.lab980.com>";
  const subject = "Your Lucky Felt sign-in code";
  const text = `Your Lucky Felt sign-in code is ${code}\n\nIt expires in 10 minutes. If you didn't try to sign in, you can ignore this email.`;
  const tp = getTransporter();
  if (!tp) {
    console.log(`[mailer] no SMTP configured — sign-in code for ${email}: ${code}`);
    return { delivered: false };
  }
  const transport = await tp;
  await transport.sendMail({ from, to: email, subject, text });
  return { delivered: true };
}
