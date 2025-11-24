// emor-os/app/api/email-bots/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// GET all bot configs
export async function GET() {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("email_bot_configs")
    .select("*")
    .order("key");

  if (error) {
    console.error("[email-bots] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bots: data }, { status: 200 });
}

// UPDATE a bot config
export async function POST(req: Request) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!body?.key) {
    return NextResponse.json(
      { error: "Missing bot key" },
      { status: 400 }
    );
  }

  const { key, subject, html_template, enabled } = body;

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("email_bot_configs")
    .update({
      subject,
      html_template,
      enabled,
    })
    .eq("key", key)
    .select()
    .single();

  if (error) {
    console.error("[email-bots] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bot: data }, { status: 200 });
}
