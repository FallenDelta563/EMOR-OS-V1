// emor-os/app/email-bots/page.tsx

import { supabaseAdmin } from "@/lib/supabaseServer";
import EmailBotManagerClient, {
  EmailBotConfig,
} from "./EmailBotManagerClient";

export const dynamic = "force-dynamic";

export default async function EmailBotsPage() {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("email_bot_configs")
    .select("*")
    .order("key");

  if (error) {
    console.error("[email-bots] page load error:", error);
  }

  const bots = (data ?? []) as EmailBotConfig[];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Email Bot Management
        </h1>
        <p className="mt-1 text-sm text-slate-500 max-w-xl">
          Control subjects, templates, and enabled status for your automatic
          replies (Newsletter, Consultation, Partnership). Changes here affect
          what your public site sends on new inquiries.
        </p>
      </div>

      <EmailBotManagerClient initialBots={bots} />
    </div>
  );
}
