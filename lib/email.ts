import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM ?? "EMOR Inquiries <inquiries@emorai.com>";

// Default transporter (kept for backward compatibility)
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Create a transporter with custom config
function createTransporter(config?: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
}) {
  if (!config) {
    return transporter; // Use default
  }

  return nodemailer.createTransport({
    host: config.host || process.env.SMTP_HOST,
    port: config.port || Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: {
      user: config.user || process.env.SMTP_USER,
      pass: config.pass || process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail({
  to,
  subject,
  html,
  smtpConfig,
}: {
  to: string;
  subject: string;
  html: string;
  smtpConfig?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
  };
}) {
  const from = smtpConfig?.from || FROM;
  
  if (!from) {
    throw new Error("EMAIL_FROM is not set");
  }

  // Create transporter with custom config if provided
  const transporterToUse = createTransporter(smtpConfig);

  return transporterToUse.sendMail({
    from,
    to,
    subject,
    html,
  });
}