import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = supabaseAdmin();

  // This will error until you create the "leads" table in Supabase.
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Leads</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead: any) => (
              <tr key={lead.id} className="border-t border-slate-800">
                <td className="px-3 py-2">
                  {lead.created_at
                    ? new Date(lead.created_at).toLocaleString()
                    : "-"}
                </td>
                <td className="px-3 py-2">{lead.full_name ?? "-"}</td>
                <td className="px-3 py-2">{lead.email ?? "-"}</td>
                <td className="px-3 py-2">{lead.source ?? "-"}</td>
                <td className="px-3 py-2">{lead.status ?? "new"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
