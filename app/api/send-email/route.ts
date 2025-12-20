import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { to, subject, message, inquiryId, emailAccount } = await req.json();

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: "Missing to / subject / message" },
        { status: 400 }
      );
    }

    // Determine which SMTP config to use based on emailAccount
    const useSecondary = emailAccount === '2';
    
    // Build proper "from" field with name and email
    const fromName = useSecondary ? (process.env.EMAIL_FROM_2 || 'EMOR AI') : (process.env.EMAIL_FROM || 'EMOR Inquiries');
    const fromEmail = useSecondary ? process.env.SMTP_USER_2 : process.env.SMTP_USER;
    const fromFormatted = `${fromName} <${fromEmail}>`;
    
    const smtpConfig = {
      host: useSecondary ? process.env.SMTP_HOST_2 : process.env.SMTP_HOST,
      port: parseInt(useSecondary ? process.env.SMTP_PORT_2 || '465' : process.env.SMTP_PORT || '465'),
      user: useSecondary ? process.env.SMTP_USER_2 : process.env.SMTP_USER,
      pass: useSecondary ? process.env.SMTP_PASS_2 : process.env.SMTP_PASS,
      from: fromFormatted,
    };

    // 1) Send email with selected account
    const info = await sendEmail({
      to,
      subject,
      html: message.replace(/\n/g, "<br />"),
      smtpConfig, // Pass the config to sendEmail
    });

    // 2) Log to email_logs if we know which inquiry this belongs to
    if (inquiryId) {
      const supabase = supabaseAdmin();

      const bodyPreview =
        message.length > 300 ? message.slice(0, 297) + "..." : message;

      await supabase.from("email_logs").insert({
        inquiry_id: inquiryId,
        direction: "outbound",
        from_email: smtpConfig.user, // Use the actual account that sent it
        to_email: to,
        subject,
        body_preview: bodyPreview,
        status: "sent",
        provider_message_id: info?.messageId ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("OS send-email error:", err);

    // Best effort: if we have inquiryId, write a failed log
    try {
      const { inquiryId, to, subject, message, emailAccount } = await req.json();
      if (inquiryId && to) {
        const supabase = supabaseAdmin();
        const bodyPreview =
          message && message.length > 300
            ? message.slice(0, 297) + "..."
            : message;

        const useSecondary = emailAccount === '2';
        const fromEmail = useSecondary ? process.env.SMTP_USER_2 : process.env.SMTP_USER;

        await supabase.from("email_logs").insert({
          inquiry_id: inquiryId,
          direction: "outbound",
          from_email: fromEmail,
          to_email: to,
          subject,
          body_preview: bodyPreview,
          status: "failed",
          error_message: String(err?.message || "Unknown error"),
        });
      }
    } catch {
      // ignore secondary failure
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}