import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { to, subject, message, inquiryId } = await req.json();

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: "Missing to / subject / message" },
        { status: 400 }
      );
    }

    // 1) Send email
    const info = await sendEmail({
      to,
      subject,
      html: message.replace(/\n/g, "<br />"),
    });

    // 2) Log to email_logs if we know which inquiry this belongs to
    if (inquiryId) {
      const supabase = supabaseAdmin();

      const bodyPreview =
        message.length > 300 ? message.slice(0, 297) + "..." : message;

      await supabase.from("email_logs").insert({
        inquiry_id: inquiryId,
        direction: "outbound",
        from_email: process.env.SMTP_USER,
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
      const { inquiryId, to, subject, message } = await req.json();
      if (inquiryId && to) {
        const supabase = supabaseAdmin();
        const bodyPreview =
          message && message.length > 300
            ? message.slice(0, 297) + "..."
            : message;

        await supabase.from("email_logs").insert({
          inquiry_id: inquiryId,
          direction: "outbound",
          from_email: process.env.SMTP_USER,
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
