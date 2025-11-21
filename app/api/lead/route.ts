import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || !body.email) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      full_name: body.full_name ?? null,
      email: body.email,
      phone: body.phone ?? null,
      source: body.source ?? "website",
      page: body.page ?? null,
      status: "new",
      utm: body.utm ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Lead insert error", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }

  // TODO: trigger email bot + insert into email_log / lead_events

  return NextResponse.json({ lead: data }, { status: 201 });
}
