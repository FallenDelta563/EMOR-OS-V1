"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function ActionTodayPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    const { data } = await supabaseBrowser
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;

    const now = new Date();

    const due = data.filter((lead: any) => {
      const nextFollowUp = lead.next_follow_up_at
        ? new Date(lead.next_follow_up_at)
        : null;

      const isNew = lead.status === "new";
      const isDue = nextFollowUp && nextFollowUp <= now;

      return isNew || isDue;
    });

    setLeads(due);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-10 text-gray-500 text-xl">
        Loading Action Items...
      </div>
    );
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl font-light mb-6">Action Today</h1>

      {leads.length === 0 && (
        <p className="text-gray-500">Nothing urgent. Good job.</p>
      )}

      <div className="space-y-4">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="border border-gray-200 rounded-xl p-6 bg-white"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">{lead.form?.name || "Unknown"}</h2>
                <p className="text-gray-500">{lead.form?.email}</p>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                {lead.status || "new"}
              </span>
            </div>

            <div className="mt-4">
              <p className="text-gray-700 font-medium">
                Next Step:
              </p>
              <p className="text-gray-600">
                {lead.next_step || "No next step set."}
              </p>
            </div>

            <button
              onClick={() => (window.location.href = `/inquiries?lead=${lead.id}`)}
              className="mt-4 px-6 py-2 bg-black text-white rounded-lg"
            >
              Open Lead
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
