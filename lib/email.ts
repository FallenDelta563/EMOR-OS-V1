import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM ?? "EMOR Inquiries <inquiries@emorai.com>";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!FROM) {
    throw new Error("EMAIL_FROM is not set");
  }

  return transporter.sendMail({
    from: FROM,
    to,
    subject,
    html,
  });
}
