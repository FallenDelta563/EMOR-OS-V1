// lib/emailPreferences.ts
import { supabaseAdmin } from "@/lib/supabaseServer";

export type EmailChannel = "newsletter" | "outreach" | "transactional";

export interface EmailPreferences {
  id: string;
  email: string;
  allow_newsletter: boolean;
  allow_outreach: boolean;
  unsubscribed_all: boolean;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  unsubscribed_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Normalize base app URL and build unsubscribe URL
export function buildUnsubscribeUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://emorai.com";

  const normalized = base.replace(/\/$/, "");
  return `${normalized}/unsubscribe?token=${encodeURIComponent(token)}`;
}

// Ensure there's a row in email_preferences for this email
export async function ensureEmailPreferences(
  email: string
): Promise<EmailPreferences> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = supabaseAdmin();

  // 1) Try to load existing prefs
  const { data, error } = await supabase
    .from("email_preferences")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error("Error loading email_preferences", error);
    throw error;
  }

  // If row exists and already has a token, just return it
  if (data && data.unsubscribe_token) {
    return data as EmailPreferences;
  }

  const token = globalThis.crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

  // 2) If no row, insert one
  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from("email_preferences")
      .insert({
        email: normalizedEmail,
        unsubscribe_token: token,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("Error inserting email_preferences", insertError);
      throw insertError || new Error("Failed to create email preferences");
    }

    return inserted as EmailPreferences;
  }

  // 3) If row exists but token was missing, update it
  const { data: updated, error: updateError } = await supabase
    .from("email_preferences")
    .update({ unsubscribe_token: token })
    .eq("id", data.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    console.error("Error updating email_preferences token", updateError);
    throw updateError || new Error("Failed to update email preferences");
  }

  return updated as EmailPreferences;
}

// Check if we are allowed to send on a given channel
export function canSendOnChannel(
  prefs: EmailPreferences,
  channel: EmailChannel
): boolean {
  if (prefs.unsubscribed_all) return false;

  if (channel === "newsletter") {
    return prefs.allow_newsletter;
  }

  if (channel === "outreach") {
    return prefs.allow_outreach;
  }

  // transactional – always allowed (unless global kill switch)
  if (channel === "transactional") {
    return true;
  }

  return false;
}
