// app/api/unsubscribe/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body.token as string | undefined;
    const reason = (body.reason as string | undefined)?.slice(0, 500) || null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    // 👇 CALL the factory to get a client
    const supabase = supabaseAdmin();

    // Flip all marketing channels off for this email
    const { data, error } = await supabase
      .from("email_preferences")
      .update({
        allow_newsletter: false,
        allow_outreach: false,
        unsubscribed_all: true,
        unsubscribed_at: new Date().toISOString(),
        unsubscribed_reason: reason,
      })
      .eq("unsubscribe_token", token)
      .select("email")
      .maybeSingle();

    if (error) {
      console.error("Error updating email_preferences", error);
      return NextResponse.json(
        { error: "Failed to unsubscribe" },
        { status: 500 }
      );
    }

    if (!data) {
      // invalid or already-used token
      return NextResponse.json(
        { error: "Invalid or expired unsubscribe link" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: data.email,
    });
  } catch (err) {
    console.error("Unsubscribe API error", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
