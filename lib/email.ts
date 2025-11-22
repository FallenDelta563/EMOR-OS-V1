import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({ subject, html }: { subject: string; html: string }) {
  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not set");
  }

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_FROM, // Every lead gets sent into inquiries inbox
    subject,
    html,
  });
}
