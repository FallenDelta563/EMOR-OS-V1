"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

interface EmailLog {
  id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  to_email: string;
  subject: string | null;
  status: string | null;
  sent_at: string | null;
}

interface Note {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  type: "Partnership" | "Consultation" | "Newsletter";
  score: number;
  status: "new" | "contacted" | "qualified" | "converted";
  notes: Note[];
  formData: any;
  created_at: string;
  emailLogs: EmailLog[];
}

export default function InquiriesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deletedLeads, setDeletedLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"focus" | "grid">("focus");
  const [currentTab, setCurrentTab] = useState<"leads" | "settings">("leads");
  const [noteText, setNoteText] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});

  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Email viewing state
  const [viewingEmail, setViewingEmail] = useState<EmailLog | null>(null);
  const [emailContent, setEmailContent] = useState<string>("");
  const [loadingEmailContent, setLoadingEmailContent] = useState(false);

  // email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchDeletedLeads();

    const savedStatuses = localStorage.getItem("lead-statuses");
    if (savedStatuses) {
      setLeadStatuses(JSON.parse(savedStatuses));
    }

    const channel = supabaseBrowser
      .channel("inquiries-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        () => {
          fetchLeads();
          fetchDeletedLeads();
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabaseBrowser
        .from("inquiries")
        .select(
          `
          *,
          email_logs (
            id,
            direction,
            from_email,
            to_email,
            subject,
            status,
            sent_at
          )
        `
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching leads:", error);
        throw error;
      }

      const savedStatuses = localStorage.getItem("lead-statuses");
      const statusMap = savedStatuses ? JSON.parse(savedStatuses) : {};

      if (data && data.length > 0) {
        const leadIds = data.map((item) => item.id);
        const { data: notesData, error: notesError } = await supabaseBrowser
          .from("lead_notes")
          .select("*")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: true });

        if (notesError) {
          console.error("Error fetching notes:", notesError);
        }

        const notesByLead: Record<string, Note[]> = {};
        (notesData || []).forEach((n) => {
          if (!notesByLead[n.lead_id]) notesByLead[n.lead_id] = [];
          notesByLead[n.lead_id].push({
            id: n.id,
            lead_id: n.lead_id,
            note: n.note,
            created_at: n.created_at,
          });
        });

        const processed: Lead[] = data.map((item: any) => {
          const form = item.form || {};

          let type: Lead["type"] = "Newsletter";
          let score = 0;

          if (item.page?.includes("partnership")) {
            type = "Partnership";
            score = 95;
          } else if (item.page?.includes("consultation")) {
            type = "Consultation";
            score = 70;
          } else {
            score = 30;
          }

          if (form.company) score += 5;

          return {
            id: item.id,
            name: form.name || form.full_name || form.role || "Unknown",
            email: form.email || "",
            company: form.company || "",
            phone: form.phone || "",
            type,
            score: Math.min(100, score),
            status: (statusMap[item.id] || "new") as Lead["status"],
            notes: notesByLead[item.id] || [],
            formData: form,
            created_at: item.created_at,
            emailLogs: item.email_logs || [],
          };
        });

        setLeads(processed);
        if (processed.length > 0 && currentTab === "leads") {
          setSelectedLead((prev) => {
            if (prev) {
              const stillExists = processed.find((p) => p.id === prev.id);
              return stillExists ?? processed[0];
            }
            return processed[0];
          });
        }
      } else {
        setLeads([]);
        if (currentTab === "leads") {
          setSelectedLead(null);
        }
      }
    } catch (err) {
      console.error("Error in fetchLeads:", err);
      setLeads([]);
      if (currentTab === "leads") {
        setSelectedLead(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletedLeads = async () => {
    try {
      const { data, error } = await supabaseBrowser
        .from("inquiries")
        .select("*")
        .eq("is_deleted", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const processed: Lead[] = data.map((item: any) => {
          const form = item.form || {};
          let type: Lead["type"] = "Newsletter";
          let score = 0;

          if (item.page?.includes("partnership")) {
            type = "Partnership";
            score = 95;
          } else if (item.page?.includes("consultation")) {
            type = "Consultation";
            score = 70;
          } else {
            score = 30;
          }

          if (form.company) score += 5;

          return {
            id: item.id,
            name: form.name || form.full_name || form.role || "Unknown",
            email: form.email || "",
            company: form.company || "",
            phone: form.phone || "",
            type,
            score: Math.min(100, score),
            status: "new" as Lead["status"],
            notes: [],
            formData: form,
            created_at: item.created_at,
            emailLogs: [],
          };
        });

        setDeletedLeads(processed);
      }
    } catch (err) {
      console.error("Error fetching deleted leads:", err);
    }
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const updateLeadStatus = (leadId: string, newStatus: string) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, status: newStatus as Lead["status"] }
          : lead
      )
    );

    setSelectedLead((prev) =>
      prev && prev.id === leadId
        ? ({ ...prev, status: newStatus } as Lead)
        : prev
    );

    const updatedStatuses = { ...leadStatuses, [leadId]: newStatus };
    setLeadStatuses(updatedStatuses);
    localStorage.setItem("lead-statuses", JSON.stringify(updatedStatuses));

    const statusElement = document.getElementById(`status-saved-${leadId}`);
    if (statusElement) {
      statusElement.classList.remove("opacity-0");
      setTimeout(() => {
        statusElement.classList.add("opacity-0");
      }, 2000);
    }
  };

  const deleteLead = async () => {
    if (!selectedLead) return;

    try {
      const { error } = await supabaseBrowser
        .from("inquiries")
        .update({ is_deleted: true })
        .eq("id", selectedLead.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      await fetchLeads();
      await fetchDeletedLeads();
    } catch (err) {
      console.error("Error deleting lead:", err);
    }
  };

  const recoverLead = async (leadId: string) => {
    try {
      const { error } = await supabaseBrowser
        .from("inquiries")
        .update({ is_deleted: false })
        .eq("id", leadId);

      if (error) throw error;

      await fetchLeads();
      await fetchDeletedLeads();
    } catch (err) {
      console.error("Error recovering lead:", err);
    }
  };

  const permanentlyDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure? This will permanently delete this lead and cannot be undone.")) {
      return;
    }

    try {
      // Delete notes first
      await supabaseBrowser.from("lead_notes").delete().eq("lead_id", leadId);
      
      // Delete email logs
      await supabaseBrowser.from("email_logs").delete().eq("inquiry_id", leadId);
      
      // Delete the lead
      const { error } = await supabaseBrowser
        .from("inquiries")
        .delete()
        .eq("id", leadId);

      if (error) throw error;

      await fetchDeletedLeads();
    } catch (err) {
      console.error("Error permanently deleting lead:", err);
    }
  };

  const addNote = async () => {
    if (!selectedLead || !noteText.trim()) return;

    try {
      const { data, error } = await supabaseBrowser
        .from("lead_notes")
        .insert({
          lead_id: selectedLead.id,
          note: noteText.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      const newNote: Note = {
        id: data.id,
        lead_id: selectedLead.id,
        note: data.note,
        created_at: data.created_at,
      };

      const updatedLead: Lead = {
        ...selectedLead,
        notes: [...selectedLead.notes, newNote],
      };

      setSelectedLead(updatedLead);
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? updatedLead : l))
      );

      setNoteText("");
      setShowNoteField(false);
    } catch (err) {
      console.error("Error adding note:", err);
    }
  };

  const updateNote = async (noteId: string, newText: string) => {
    if (!selectedLead || !newText.trim()) return;

    try {
      const { error } = await supabaseBrowser
        .from("lead_notes")
        .update({ note: newText.trim() })
        .eq("id", noteId);

      if (error) throw error;

      const updatedNotes = selectedLead.notes.map((n) =>
        n.id === noteId ? { ...n, note: newText.trim() } : n
      );

      const updatedLead: Lead = {
        ...selectedLead,
        notes: updatedNotes,
      };

      setSelectedLead(updatedLead);
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? updatedLead : l))
      );

      setEditingNoteId(null);
      setEditingNoteText("");
    } catch (err) {
      console.error("Error updating note:", err);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!selectedLead) return;
    if (!confirm("Delete this note?")) return;

    try {
      const { error } = await supabaseBrowser
        .from("lead_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      const updatedNotes = selectedLead.notes.filter((n) => n.id !== noteId);

      const updatedLead: Lead = {
        ...selectedLead,
        notes: updatedNotes,
      };

      setSelectedLead(updatedLead);
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? updatedLead : l))
      );
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const viewEmailContent = async (emailLog: EmailLog) => {
    setViewingEmail(emailLog);
    setLoadingEmailContent(true);
    
    try {
      // Try to fetch the full email content from your email logs table
      const { data, error } = await supabaseBrowser
        .from("email_logs")
        .select("*")
        .eq("id", emailLog.id)
        .single();

      if (error) {
        console.error("Error fetching email:", error);
      }

      // Check for various possible field names where content might be stored
      const content = data?.html_body || 
                     data?.body || 
                     data?.message || 
                     data?.content ||
                     data?.text_body ||
                     data?.html;

      if (content) {
        // If we have HTML content, use it; otherwise wrap plain text in paragraph
        if (content.includes('<') || content.includes('&lt;')) {
          setEmailContent(content);
        } else {
          setEmailContent(`<div style="white-space: pre-wrap; font-family: system-ui;">${content}</div>`);
        }
      } else {
        // If no body content, show what we have from the log
        setEmailContent(`
          <div style="padding: 20px; background: #f9fafb; border-radius: 8px; border: 2px solid #e5e7eb;">
            <h3 style="margin-top: 0; color: #1f2937;">Email Details</h3>
            <p><strong>Subject:</strong> ${emailLog.subject || 'No subject'}</p>
            <p><strong>${emailLog.direction === 'outbound' ? 'To' : 'From'}:</strong> ${emailLog.direction === 'outbound' ? emailLog.to_email : emailLog.from_email}</p>
            <p><strong>Status:</strong> ${emailLog.status || 'Unknown'}</p>
            <p><strong>Sent:</strong> ${emailLog.sent_at ? new Date(emailLog.sent_at).toLocaleString() : 'Unknown'}</p>
            <div style="margin-top: 20px; padding: 15px; background: white; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; color: #6b7280;">
                <strong>Note:</strong> Full email content is not stored in the database. Only metadata is available.
              </p>
            </div>
          </div>
        `);
      }
    } catch (err) {
      console.error("Error loading email:", err);
      setEmailContent(`
        <div style="padding: 20px; text-align: center; color: #ef4444;">
          <p>Unable to load email content</p>
          <p style="font-size: 14px; color: #9ca3af;">There was an error retrieving this email.</p>
        </div>
      `);
    } finally {
      setLoadingEmailContent(false);
    }
  };

  const getTypeColor = (type: Lead["type"]) => {
    switch (type) {
      case "Partnership":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "Consultation":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Newsletter":
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusColor = (status: Lead["status"]) => {
    switch (status) {
      case "new":
        return "bg-green-100 text-green-700 border-green-200";
      case "contacted":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "qualified":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "converted":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Tab Navigation */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Company OS</h1>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-gray-100 rounded-lg">
                <span className="text-sm font-semibold text-gray-600">
                  {leads.length} Active Lead{leads.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentTab("leads")}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                currentTab === "leads"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              📋 Leads
            </button>
            <button
              onClick={() => setCurrentTab("settings")}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                currentTab === "settings"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1800px] mx-auto p-8">
        {currentTab === "leads" ? (
          // LEADS TAB
          <>
            {leads.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">📭</div>
                <h2 className="text-2xl font-bold text-gray-400 mb-2">
                  No leads yet
                </h2>
                <p className="text-gray-400">
                  New submissions will appear here
                </p>
              </div>
            ) : (
              <>
                {/* View Mode Toggle */}
                <div className="mb-6 flex gap-2">
                  <button
                    onClick={() => setViewMode("focus")}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      viewMode === "focus"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Focus Mode
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      viewMode === "grid"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Grid View
                  </button>
                </div>

                {viewMode === "grid" ? (
                  // GRID VIEW
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => {
                          setSelectedLead(lead);
                          setViewMode("focus");
                        }}
                        className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                              {lead.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {lead.email}
                            </p>
                          </div>
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getTypeColor(
                              lead.type
                            )}`}
                          >
                            {lead.type}
                          </div>
                        </div>

                        {lead.company && (
                          <div className="mb-3 text-sm text-gray-600">
                            🏢 {lead.company}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {getTimeAgo(lead.created_at)}
                          </span>
                          <span className="text-sm font-bold text-blue-600">
                            Score: {lead.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // FOCUS MODE
                  <div className="grid grid-cols-12 gap-8">
                    {/* Left Sidebar - Lead List */}
                    <div className="col-span-3 space-y-3">
                      {leads.map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedLead?.id === lead.id
                              ? "bg-blue-50 border-blue-500 shadow-lg"
                              : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 truncate">
                                {lead.name}
                              </h3>
                              <p className="text-xs text-gray-500 truncate">
                                {lead.email}
                              </p>
                            </div>
                            <div
                              className={`ml-2 px-2 py-0.5 rounded text-xs font-bold border ${getTypeColor(
                                lead.type
                              )}`}
                            >
                              {lead.type.slice(0, 4)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-400">
                              {getTimeAgo(lead.created_at)}
                            </span>
                            <span className="text-xs font-bold text-blue-600">
                              {lead.score}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Main Content Area */}
                    {selectedLead && (
                      <div className="col-span-9 bg-white rounded-xl border-2 border-gray-200 p-8">
                        <div className="space-y-8">
                          {/* Header Section */}
                          <div className="flex items-start justify-between pb-6 border-b-2 border-gray-200">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h2 className="text-3xl font-bold text-gray-900">
                                  {selectedLead.name}
                                </h2>
                                <div
                                  className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getTypeColor(
                                    selectedLead.type
                                  )}`}
                                >
                                  {selectedLead.type}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <p className="text-gray-600">
                                  📧 {selectedLead.email}
                                </p>
                                {selectedLead.company && (
                                  <p className="text-gray-600">
                                    🏢 {selectedLead.company}
                                  </p>
                                )}
                                {selectedLead.phone && (
                                  <p className="text-gray-600">
                                    📱 {selectedLead.phone}
                                  </p>
                                )}
                                <p className="text-sm text-gray-400">
                                  Submitted {getTimeAgo(selectedLead.created_at)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-3">
                              <div className="px-6 py-3 bg-blue-600 text-white rounded-xl text-2xl font-bold">
                                Score: {selectedLead.score}
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => setIsEmailModalOpen(true)}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
                                >
                                  📧 Email
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(true)}
                                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Status Section */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
                              Status
                            </h3>
                            <div className="flex items-center gap-3">
                              <select
                                value={selectedLead.status}
                                onChange={(e) =>
                                  updateLeadStatus(
                                    selectedLead.id,
                                    e.target.value
                                  )
                                }
                                className={`px-4 py-2 rounded-lg font-semibold border-2 cursor-pointer transition-all ${getStatusColor(
                                  selectedLead.status
                                )}`}
                              >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="qualified">Qualified</option>
                                <option value="converted">Converted</option>
                              </select>
                              <span
                                id={`status-saved-${selectedLead.id}`}
                                className="text-sm text-green-600 font-medium opacity-0 transition-opacity"
                              >
                                ✓ Saved
                              </span>
                            </div>
                          </div>

                          {/* Notes & Email History Section */}
                          <div className="space-y-6">
                            {/* Notes */}
                            {(selectedLead.notes.length > 0 ||
                              showNoteField) && (
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                                    Notes ({selectedLead.notes.length})
                                  </h3>
                                  {!showNoteField && (
                                    <button
                                      onClick={() => setShowNoteField(true)}
                                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-all shadow-sm"
                                    >
                                      + Add Note
                                    </button>
                                  )}
                                </div>

                                <div className="space-y-3">
                                    {selectedLead.notes.map((note) => (
                                      <div
                                        key={note.id}
                                        className="group p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all"
                                      >
                                        {editingNoteId === note.id ? (
                                          // EDITING MODE
                                          <div className="space-y-3">
                                            <textarea
                                              value={editingNoteText}
                                              onChange={(e) =>
                                                setEditingNoteText(
                                                  e.target.value
                                                )
                                              }
                                              className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                              rows={3}
                                              autoFocus
                                            />
                                            <div className="flex gap-2">
                                              <button
                                                onClick={() =>
                                                  updateNote(
                                                    note.id,
                                                    editingNoteText
                                                  )
                                                }
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-all"
                                              >
                                                ✓ Save
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingNoteId(null);
                                                  setEditingNoteText("");
                                                }}
                                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-medium transition-all"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          // VIEW MODE
                                          <>
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                              <p className="text-gray-900 flex-1 leading-relaxed">
                                                {note.note}
                                              </p>
                                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={() => {
                                                    setEditingNoteId(note.id);
                                                    setEditingNoteText(
                                                      note.note
                                                    );
                                                  }}
                                                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all"
                                                  title="Edit note"
                                                >
                                                  Edit
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    deleteNote(note.id)
                                                  }
                                                  className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-all"
                                                  title="Delete note"
                                                >
                                                  Delete
                                                </button>
                                              </div>
                                            </div>
                                            <p className="text-xs text-gray-400 font-medium">
                                              {new Date(
                                                note.created_at
                                              ).toLocaleString()}
                                            </p>
                                          </>
                                        )}
                                      </div>
                                    ))}

                                    {showNoteField && (
                                      <div className="p-5 bg-white rounded-xl border-2 border-blue-300 shadow-sm">
                                        <textarea
                                          value={noteText}
                                          onChange={(e) =>
                                            setNoteText(e.target.value)
                                          }
                                          placeholder="Type your note here..."
                                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none mb-3"
                                          rows={3}
                                          autoFocus
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            onClick={addNote}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
                                          >
                                            ✓ Save Note
                                          </button>
                                          <button
                                            onClick={() => {
                                              setShowNoteField(false);
                                              setNoteText("");
                                            }}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                            {!showNoteField &&
                              selectedLead.notes.length === 0 && (
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
                                    Notes
                                  </h3>
                                  <button
                                    onClick={() => setShowNoteField(true)}
                                    className="w-full py-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium"
                                  >
                                    + Add your first note
                                  </button>
                                </div>
                              )}

                            {/* Email history */}
                            {selectedLead.emailLogs.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
                                    Email History ({selectedLead.emailLogs.length})
                                  </h3>
                                  <div className="space-y-3">
                                    {[...selectedLead.emailLogs]
                                      .sort((a, b) => {
                                        const da = a.sent_at
                                          ? new Date(a.sent_at).getTime()
                                          : 0;
                                        const db = b.sent_at
                                          ? new Date(b.sent_at).getTime()
                                          : 0;
                                        return db - da;
                                      })
                                      .map((log) => (
                                        <div
                                          key={log.id}
                                          onClick={() => viewEmailContent(log)}
                                          className="p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                                        >
                                          <div className="flex gap-3">
                                            <div className="text-xl mt-0.5">
                                              {log.direction === "outbound"
                                                ? "📤"
                                                : "📥"}
                                            </div>
                                            <div className="flex-1">
                                              <div className="flex justify-between items-start mb-2">
                                                <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                  {log.subject || "(no subject)"}
                                                </div>
                                                <div className="text-xs text-gray-400 ml-3">
                                                  {log.sent_at
                                                    ? new Date(
                                                        log.sent_at
                                                      ).toLocaleString()
                                                    : "—"}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>
                                                  {log.direction === "outbound"
                                                    ? `To: ${log.to_email}`
                                                    : `From: ${log.from_email}`}
                                                </span>
                                                {log.status && (
                                                  <>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                                                      {log.status}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                              <div className="mt-2 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Click to view full email →
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                          </div>

                          {/* Submission Details */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
                              Submission Details
                            </h3>
                            <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-8">
                              <div className="space-y-4">
                                {Object.entries(selectedLead.formData).map(
                                  ([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex py-4 border-b border-gray-200 last:border-0"
                                    >
                                      <div className="w-1/3 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                                        {key.replace(/_/g, " ")}
                                      </div>
                                      <div className="w-2/3 text-base text-gray-900 font-medium">
                                        {String(value) || "—"}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          // SETTINGS TAB
          <div className="space-y-8">
            {/* System Overview */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                System Overview
              </h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {leads.length}
                  </div>
                  <div className="text-sm font-semibold text-gray-600 uppercase">
                    Active Leads
                  </div>
                </div>
                <div className="p-6 bg-red-50 rounded-xl border-2 border-red-200">
                  <div className="text-4xl font-bold text-red-600 mb-2">
                    {deletedLeads.length}
                  </div>
                  <div className="text-sm font-semibold text-gray-600 uppercase">
                    Deleted Leads
                  </div>
                </div>
                <div className="p-6 bg-green-50 rounded-xl border-2 border-green-200">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {leads.reduce((sum, lead) => sum + lead.notes.length, 0)}
                  </div>
                  <div className="text-sm font-semibold text-gray-600 uppercase">
                    Total Notes
                  </div>
                </div>
              </div>
            </div>

            {/* Deleted Leads Management */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Deleted Leads
              </h2>
              {deletedLeads.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">✨</div>
                  <p className="text-gray-400">No deleted leads</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">
                          {lead.name}
                        </h3>
                        <p className="text-sm text-gray-500">{lead.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Deleted {getTimeAgo(lead.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => recoverLead(lead.id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
                        >
                          ♻️ Recover
                        </button>
                        <button
                          onClick={() => permanentlyDeleteLead(lead.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
                        >
                          🗑️ Delete Forever
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    fetchLeads();
                    fetchDeletedLeads();
                  }}
                  className="p-6 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-blue-200 text-left transition-all"
                >
                  <div className="text-2xl mb-2">🔄</div>
                  <div className="font-bold text-gray-900">Refresh Data</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Sync latest leads and notes
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    const data = {
                      leads: leads.length,
                      deleted: deletedLeads.length,
                      notes: leads.reduce((sum, lead) => sum + lead.notes.length, 0),
                      exported: new Date().toISOString()
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `os-stats-${Date.now()}.json`;
                    a.click();
                  }}
                  className="p-6 bg-purple-50 hover:bg-purple-100 rounded-xl border-2 border-purple-200 text-left transition-all"
                >
                  <div className="text-2xl mb-2">📊</div>
                  <div className="font-bold text-gray-900">Export Stats</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Download system statistics
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {isEmailModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              Email {selectedLead.email}
            </h3>

            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />

            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-40 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Message"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
                onClick={() => {
                  if (isSendingEmail) return;
                  setIsEmailModalOpen(false);
                }}
              >
                Cancel
              </button>

              <button
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isSendingEmail}
                onClick={async () => {
                  if (!selectedLead) return;
                  if (!emailSubject.trim() || !emailBody.trim()) return;

                  setIsSendingEmail(true);
                  try {
                    const res = await fetch("/api/send-email", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        to: selectedLead.email,
                        subject: emailSubject,
                        message: emailBody,
                        inquiryId: selectedLead.id,
                      }),
                    });

                    if (!res.ok) {
                      console.error("Failed to send email");
                    } else {
                      const now = new Date().toISOString();
                      const newLog: EmailLog = {
                        id: `temp-${Date.now()}`,
                        direction: "outbound",
                        from_email: "inquiries@emorai.com",
                        to_email: selectedLead.email,
                        subject: emailSubject,
                        status: "sent",
                        sent_at: now,
                      };

                      const updatedLead: Lead = {
                        ...selectedLead,
                        emailLogs: [...selectedLead.emailLogs, newLog],
                      };

                      setSelectedLead(updatedLead);
                      setLeads((prev) =>
                        prev.map((l) =>
                          l.id === selectedLead.id ? updatedLead : l
                        )
                      );

                      setIsEmailModalOpen(false);
                      setEmailSubject("");
                      setEmailBody("");
                    }
                  } catch (err) {
                    console.error("Error sending email:", err);
                  } finally {
                    setIsSendingEmail(false);
                  }
                }}
              >
                {isSendingEmail ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Viewer Modal */}
      {viewingEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b-2 border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">
                      {viewingEmail.direction === "outbound" ? "📤" : "📥"}
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {viewingEmail.subject || "(no subject)"}
                    </h2>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold">
                        {viewingEmail.direction === "outbound" ? "To:" : "From:"}
                      </span>{" "}
                      {viewingEmail.direction === "outbound"
                        ? viewingEmail.to_email
                        : viewingEmail.from_email}
                    </div>
                    <div>
                      <span className="font-semibold">Date:</span>{" "}
                      {viewingEmail.sent_at
                        ? new Date(viewingEmail.sent_at).toLocaleString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Unknown"}
                    </div>
                    {viewingEmail.status && (
                      <div>
                        <span className="font-semibold">Status:</span>{" "}
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          {viewingEmail.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setViewingEmail(null);
                    setEmailContent("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg
                    className="w-6 h-6 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {loadingEmailContent ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-gray-500 font-medium">Loading email content...</div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div
                    className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600"
                    dangerouslySetInnerHTML={{ __html: emailContent }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t-2 border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setViewingEmail(null);
                  setEmailContent("");
                }}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">Delete Lead?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedLead?.name}? You&apos;ll
              be able to recover this lead later from Settings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteLead}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
              >
                Delete Lead
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}