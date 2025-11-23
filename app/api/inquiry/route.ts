import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendAutoReplyForInquiry } from "@/lib/emailBot";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Be generous about the shape of the payload
    const form = body.form ?? body.data ?? body;
    const page =
      body.page ??
      body.source_page ??
      form.page ??
      form.source_page ??
      null;

    if (!form?.email) {
      return NextResponse.json(
        { error: "Missing email in form payload" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // 1) Insert into inquiries
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        form,
        page,
        is_deleted: false,
      })
      .select("id, form, page")
      .single();

    if (error || !data) {
      console.error("Error saving inquiry", error);
      return NextResponse.json(
        { error: "Failed to save inquiry" },
        { status: 500 }
      );
    }

    // 2) Kick off auto-reply (uses templates + unsubscribe prefs)
    try {
      await sendAutoReplyForInquiry({
        id: data.id,
        form: data.form,
        page: data.page,
      });
    } catch (botErr) {
      console.error("sendAutoReplyForInquiry failed", botErr);
      // we don't fail the request for the user because of this
    }

    // 3) Return ok to the frontend
    return NextResponse.json({ ok: true, inquiryId: data.id });
  } catch (err) {
    console.error("Inquiry API error", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
