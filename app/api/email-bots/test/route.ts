// emor-os/app/api/email-bots/test/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const key = body?.key as string | undefined;
  const toEmail = body?.toEmail as string | undefined;

  if (!key || !toEmail) {
    return NextResponse.json(
      { error: "Missing key or toEmail" },
      { status: 400 }
    );
  }

  // 1) Load template from email_bot_configs
  const supabase = supabaseAdmin();

  const { data: tpl, error } = await supabase
    .from("email_bot_configs")
    .select("subject, html_template, enabled")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("[email-bots/test] Failed to load template", error);
    return NextResponse.json(
      { error: "Failed to load template" },
      { status: 500 }
    );
  }

  if (!tpl) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  if (!tpl.enabled) {
    return NextResponse.json(
      { error: "Template is disabled" },
      { status: 400 }
    );
  }

  // 2) Build sample context for test email
  const ctx = {
    name: "Test User",
    email: toEmail,
    company: "Sample Company",
    message: "This is a test email from EMOR OS.",
    inquiry_id: "test-inquiry-id",
    page: key,
  };

  const subject = renderTemplate(tpl.subject, ctx);
  const html = renderTemplate(tpl.html_template, ctx);

  // 3) Send via SMTP (same env vars you already use)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      to: toEmail,
      subject,
      html,
    });

    console.log("[email-bots/test] Sent test email", {
      key,
      toEmail,
      messageId: info.messageId,
    });

    return NextResponse.json(
      { ok: true, messageId: info.messageId },
      { status: 200 }
    );
  } catch (err) {
    console.error("[email-bots/test] Failed to send", err);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}

// Simple {{placeholder}} renderer
function renderTemplate(
  template: string,
  ctx: Record<string, string>
): string {
  let out = template;

  const keys: (keyof typeof ctx)[] = [
    "name",
    "email",
    "company",
    "message",
    "inquiry_id",
    "page",
  ];

  for (const key of keys) {
    const value = ctx[key] ?? "";
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    out = out.replace(regex, value);
  }

  return out;
}
