// lib/emailBot.ts
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email";
import {
  ensureEmailPreferences,
  buildUnsubscribeUrl,
  canSendOnChannel,
  EmailChannel,
} from "./emailPreferences";

type TemplateKey = "newsletter_auto" | "consultation_auto" | "partnership_auto";

interface EmailTemplate {
  id: string;
  key: TemplateKey;
  label: string;
  subject: string;
  body_html: string;
  channel: EmailChannel;
  enabled: boolean;
}

interface InquiryLike {
  id: string;
  page: string | null;
  form: any; // should have at least email, maybe name, company, etc.
}

function pickTemplateKeyFromPage(page: string | null): TemplateKey {
  if (!page) return "newsletter_auto";

  const lower = page.toLowerCase();
  if (lower.includes("partnership")) return "partnership_auto";
  if (lower.includes("consultation")) return "consultation_auto";
  if (lower.includes("newsletter")) return "newsletter_auto";

  // fallback
  return "newsletter_auto";
}

function renderTemplateString(
  input: string,
  form: any,
  unsubscribeUrl: string
): string {
  const replacements: Record<string, string> = {
    name:
      form?.name ||
      form?.full_name ||
      form?.first_name ||
      form?.role ||
      "there",
    company: form?.company || "",
    email: form?.email || "",
    unsubscribe_url: unsubscribeUrl,
  };

  return input.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => {
    const val = replacements[key];
    return typeof val === "string" ? val : "";
  });
}

export async function sendAutoReplyForInquiry(inquiry: InquiryLike) {
  const form = inquiry.form || {};
  const toEmail = form.email?.trim();
  if (!toEmail) {
    // nothing to send to
    return;
  }

  const supabase = supabaseAdmin();
  const templateKey = pickTemplateKeyFromPage(inquiry.page);

  // 1) Load email template
  const { data: tpl, error: tplError } = await supabase
    .from("email_templates")
    .select("id, key, subject, body_html, channel, enabled")
    .eq("key", templateKey)
    .maybeSingle();

  if (tplError) {
    console.error("Auto-reply: error loading template", tplError);
    return;
  }

  if (!tpl || !tpl.enabled) {
    // Template missing or disabled – just skip quietly
    return;
  }

  const template = tpl as EmailTemplate;

  // 2) Ensure email preferences exist + get unsubscribe URL
  let prefs;
  try {
    prefs = await ensureEmailPreferences(toEmail);
  } catch (err) {
    console.error("Auto-reply: failed to ensure email_preferences", err);
    // Fail safe: if prefs can't be loaded / created, don't send
    return;
  }

  const allowed = canSendOnChannel(prefs, template.channel);
  const unsubscribeUrl = buildUnsubscribeUrl(prefs.unsubscribe_token);

  const renderedSubject = renderTemplateString(
    template.subject,
    form,
    unsubscribeUrl
  );
  const renderedHtml = renderTemplateString(
    template.body_html,
    form,
    unsubscribeUrl
  );

  const fromEmail =
    process.env.EMAIL_FROM || "inquiries@emorai.com";

  // 3) If not allowed to send, log a blocked email and bail
  if (!allowed) {
    try {
      await supabase.from("email_logs").insert({
        inquiry_id: inquiry.id,
        direction: "outbound",
        from_email: fromEmail,
        to_email: toEmail,
        subject: `[BLOCKED: unsubscribed] ${renderedSubject}`,
        status: "blocked_unsubscribed",
        sent_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("Auto-reply: failed to log blocked email", logErr);
    }
    return;
  }

  // 4) Send the email
  let status: "sent" | "failed" = "sent";
  let sentAt: string | null = null;

  try {
    await sendEmail({
      to: toEmail,
      subject: renderedSubject,
      html: renderedHtml,
    });

    sentAt = new Date().toISOString();
  } catch (sendErr: any) {
    console.error("Auto-reply: sendEmail failed", sendErr);
    status = "failed";
    sentAt = new Date().toISOString();
  }

  // 5) Log to email_logs so your OS sees it
  try {
    await supabase.from("email_logs").insert({
      inquiry_id: inquiry.id,
      direction: "outbound",
      from_email: fromEmail,
      to_email: toEmail,
      subject: renderedSubject,
      status,
      sent_at: sentAt,
      // NOTE: we are not inserting html_body/body_preview here
      // to avoid mismatching your existing schema. The viewer
      // will still show metadata, and content will show the
      // “metadata only” message if those columns don’t exist.
    });
  } catch (logErr) {
    console.error("Auto-reply: failed to log email", logErr);
  }
}
