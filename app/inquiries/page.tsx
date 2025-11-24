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
  const [currentTab, setCurrentTab] = useState<"leads" | "deleted">("leads");
  const [noteText, setNoteText] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});

  // Multi-select state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedDeletedIds, setSelectedDeletedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkPermanentDeleteConfirm, setShowBulkPermanentDeleteConfirm] = useState(false);

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
            status: "new",
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

  const updateLeadStatus = (leadId: string, newStatus: Lead["status"]) => {
    const updated = { ...leadStatuses, [leadId]: newStatus };
    setLeadStatuses(updated);
    localStorage.setItem("lead-statuses", JSON.stringify(updated));

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
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

      setLeads((prev) => prev.filter((l) => l.id !== selectedLead.id));
      setSelectedLead(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting lead:", err);
    }
  };

  const bulkDeleteLeads = async () => {
    if (selectedLeadIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedLeadIds);
      const { error } = await supabaseBrowser
        .from("inquiries")
        .update({ is_deleted: true })
        .in("id", idsArray);

      if (error) throw error;

      setLeads((prev) => prev.filter((l) => !selectedLeadIds.has(l.id)));
      setSelectedLeadIds(new Set());
      setShowBulkDeleteConfirm(false);
      if (selectedLead && selectedLeadIds.has(selectedLead.id)) {
        setSelectedLead(null);
      }
    } catch (err) {
      console.error("Error bulk deleting leads:", err);
    }
  };

  const restoreLead = async (leadId: string) => {
    try {
      const { error } = await supabaseBrowser
        .from("inquiries")
        .update({ is_deleted: false })
        .eq("id", leadId);

      if (error) throw error;
    } catch (err) {
      console.error("Error restoring lead:", err);
    }
  };

  const permanentlyDeleteLead = async (leadId: string) => {
    try {
      const { error } = await supabaseBrowser
        .from("inquiries")
        .delete()
        .eq("id", leadId);

      if (error) throw error;
    } catch (err) {
      console.error("Error permanently deleting lead:", err);
    }
  };

  const bulkPermanentlyDeleteLeads = async () => {
    if (selectedDeletedIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedDeletedIds);
      const { error } = await supabaseBrowser
        .from("inquiries")
        .delete()
        .in("id", idsArray);

      if (error) throw error;

      setDeletedLeads((prev) => prev.filter((l) => !selectedDeletedIds.has(l.id)));
      setSelectedDeletedIds(new Set());
      setShowBulkPermanentDeleteConfirm(false);
    } catch (err) {
      console.error("Error bulk permanently deleting leads:", err);
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
        lead_id: data.lead_id,
        note: data.note,
        created_at: data.created_at,
      };

      const updatedLead = {
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

  const deleteNote = async (noteId: string) => {
    if (!selectedLead) return;
    try {
      const { error } = await supabaseBrowser
        .from("lead_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      const updatedLead = {
        ...selectedLead,
        notes: selectedLead.notes.filter((n) => n.id !== noteId),
      };

      setSelectedLead(updatedLead);
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLead.id ? updatedLead : l))
      );
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const startEditingNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  const saveEditedNote = async () => {
    if (!selectedLead || !editingNoteId || !editingNoteText.trim()) return;
    try {
      const { error } = await supabaseBrowser
        .from("lead_notes")
        .update({ note: editingNoteText.trim() })
        .eq("id", editingNoteId);

      if (error) throw error;

      const updatedNotes = selectedLead.notes.map((n) =>
        n.id === editingNoteId ? { ...n, note: editingNoteText.trim() } : n
      );

      const updatedLead = { ...selectedLead, notes: updatedNotes };
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

  const viewEmailContent = async (emailLog: EmailLog) => {
    setViewingEmail(emailLog);
    setLoadingEmailContent(true);
    try {
      const res = await fetch(
        `/api/get-email-content?emailId=${emailLog.id}`
      );
      if (res.ok) {
        const json = await res.json();
        setEmailContent(json.content || "No content available.");
      } else {
        setEmailContent("Failed to load email content.");
      }
    } catch (err) {
      console.error("Error fetching email content:", err);
      setEmailContent("Error loading email content.");
    } finally {
      setLoadingEmailContent(false);
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleDeletedSelection = (leadId: string) => {
    setSelectedDeletedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map((l) => l.id)));
    }
  };

  const toggleSelectAllDeleted = () => {
    if (selectedDeletedIds.size === deletedLeads.length) {
      setSelectedDeletedIds(new Set());
    } else {
      setSelectedDeletedIds(new Set(deletedLeads.map((l) => l.id)));
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium text-lg">Loading inquiries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-linear-to-br from-gray-50 via-white to-blue-50">
      {/* Modern Header with Tabs */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm shrink-0">
        <div className="px-8 py-6">
          {/* Title Section */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Inquiries
              </h1>
              <p className="text-gray-500 mt-1">
                Manage and track your leads
              </p>
            </div>

            {/* View Mode Toggle (only in leads tab) */}
            {currentTab === "leads" && (
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1.5">
                <button
                  onClick={() => setViewMode("focus")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === "focus"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  title="Focus View"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    <span>Focus</span>
                  </div>
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === "grid"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  title="Grid View"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Grid</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Modern Tab Navigation */}
          <div className="flex items-center gap-2 bg-gray-100/80 rounded-xl p-1.5 w-fit">
            <button
              onClick={() => {
                setCurrentTab("leads");
                setSelectedLeadIds(new Set());
              }}
              className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 relative ${
                currentTab === "leads"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  currentTab === "leads" ? "bg-blue-100" : "bg-gray-200"
                }`}>
                  <span className="text-lg">📬</span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span>Active Leads</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      currentTab === "leads" 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {leads.length}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setCurrentTab("deleted");
                setSelectedDeletedIds(new Set());
              }}
              className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 relative ${
                currentTab === "deleted"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  currentTab === "deleted" ? "bg-purple-100" : "bg-gray-200"
                }`}>
                  <span className="text-lg">♻️</span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span>Deleted Leads</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      currentTab === "deleted" 
                        ? "bg-purple-100 text-purple-700" 
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {deletedLeads.length}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {currentTab === "leads" ? (
        viewMode === "focus" ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Leads List - Left Sidebar */}
            <div className="w-96 bg-white/90 backdrop-blur-sm border-r border-gray-200/50 flex flex-col shadow-lg">
              {/* Multi-select controls */}
              {leads.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-200/50 bg-linear-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.size === leads.length && leads.length > 0}
                        onChange={toggleSelectAllLeads}
                        className="w-5 h-5 rounded-lg border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        {selectedLeadIds.size > 0
                          ? `${selectedLeadIds.size} selected`
                          : "Select all"}
                      </span>
                    </label>
                    {selectedLeadIds.size > 0 && (
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="px-4 py-2 text-sm text-white bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-lg font-medium shadow-sm hover:shadow transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {leads.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-linear-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center">
                      <span className="text-5xl">📭</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 text-lg">
                      No inquiries yet
                    </h3>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto">
                      When someone submits a form, it will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => {
                          if (!selectedLeadIds.has(lead.id)) {
                            setSelectedLead(lead);
                          }
                        }}
                        className={`p-5 cursor-pointer transition-all duration-200 ${
                          selectedLead?.id === lead.id
                            ? "bg-linear-to-r from-blue-50 to-purple-50 border-l-4 border-blue-600"
                            : "hover:bg-gray-50 border-l-4 border-transparent"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.has(lead.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleLeadSelection(lead.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-5 h-5 rounded-lg border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-bold text-gray-900 truncate text-lg">
                                {lead.name}
                              </h3>
                              <span
                                className={`ml-2 px-3 py-1 text-xs font-bold rounded-full shrink-0 ${
                                  lead.type === "Partnership"
                                    ? "bg-linear-to-r from-purple-500 to-pink-500 text-white"
                                    : lead.type === "Consultation"
                                    ? "bg-linear-to-r from-blue-500 to-cyan-500 text-white"
                                    : "bg-linear-to-r from-green-500 to-emerald-500 text-white"
                                }`}
                              >
                                {lead.type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 truncate mb-2">
                              {lead.email}
                            </p>
                            {lead.company && (
                              <p className="text-xs text-gray-500 truncate mb-3">
                                {lead.company}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                  lead.status === "new"
                                    ? "bg-gray-100 text-gray-700"
                                    : lead.status === "contacted"
                                    ? "bg-blue-100 text-blue-700"
                                    : lead.status === "qualified"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {lead.status}
                              </span>
                              <span className="text-xs text-gray-500 font-medium">
                                Score: {lead.score}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lead Details - Right Panel */}
            <div className="flex-1 overflow-y-auto bg-linear-to-br from-gray-50 via-white to-purple-50">
              {selectedLead ? (
                <div className="max-w-5xl mx-auto p-8">
                  {/* Header Card */}
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8 mb-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                            {selectedLead.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">
                              {selectedLead.name}
                            </h2>
                            <div className="flex items-center gap-3">
                              <span
                                className={`px-4 py-1.5 text-sm font-bold rounded-full ${
                                  selectedLead.type === "Partnership"
                                    ? "bg-linear-to-r from-purple-500 to-pink-500 text-white"
                                    : selectedLead.type === "Consultation"
                                    ? "bg-linear-to-r from-blue-500 to-cyan-500 text-white"
                                    : "bg-linear-to-r from-green-500 to-emerald-500 text-white"
                                }`}
                              >
                                {selectedLead.type}
                              </span>
                              <span className="px-4 py-1.5 text-sm font-bold bg-linear-to-r from-gray-100 to-gray-200 text-gray-700 rounded-full">
                                Score: {selectedLead.score}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Lead"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Contact Info Grid */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="bg-linear-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
                        <p className="text-sm text-gray-600 mb-1 font-medium">Email</p>
                        <p className="text-gray-900 font-semibold">{selectedLead.email}</p>
                      </div>
                      {selectedLead.phone && (
                        <div className="bg-linear-to-br from-purple-50 to-pink-50 rounded-xl p-4">
                          <p className="text-sm text-gray-600 mb-1 font-medium">Phone</p>
                          <p className="text-gray-900 font-semibold">{selectedLead.phone}</p>
                        </div>
                      )}
                      {selectedLead.company && (
                        <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                          <p className="text-sm text-gray-600 mb-1 font-medium">Company</p>
                          <p className="text-gray-900 font-semibold">{selectedLead.company}</p>
                        </div>
                      )}
                      <div className="bg-linear-to-br from-orange-50 to-amber-50 rounded-xl p-4">
                        <p className="text-sm text-gray-600 mb-1 font-medium">Submitted</p>
                        <p className="text-gray-900 font-semibold">
                          {new Date(selectedLead.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Status Selector */}
                    <div className="mb-6">
                      <p className="text-sm text-gray-600 mb-3 font-medium">Lead Status</p>
                      <div className="flex gap-3">
                        {(["new", "contacted", "qualified", "converted"] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => updateLeadStatus(selectedLead.id, status)}
                            className={`flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                              selectedLead.status === status
                                ? status === "new"
                                  ? "bg-linear-to-r from-gray-700 to-gray-600 text-white shadow-lg"
                                  : status === "contacted"
                                  ? "bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-lg"
                                  : status === "qualified"
                                  ? "bg-linear-to-r from-yellow-500 to-orange-500 text-white shadow-lg"
                                  : "bg-linear-to-r from-green-600 to-emerald-600 text-white shadow-lg"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Email Button */}
                    <button
                      onClick={() => setIsEmailModalOpen(true)}
                      className="w-full py-4 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Email
                    </button>
                  </div>

                  {/* Form Data */}
                  {selectedLead.formData && Object.keys(selectedLead.formData).length > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8 mb-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <span>📋</span>
                        Form Details
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        {Object.entries(selectedLead.formData).map(([key, value]) => (
                          <div key={key} className="bg-linear-to-br from-gray-50 to-blue-50 rounded-xl p-4">
                            <p className="text-sm text-gray-600 mb-1 font-medium">
                              {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ")}
                            </p>
                            <p className="text-gray-900 font-semibold">
                              {String(value || "—")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email History */}
                  {selectedLead.emailLogs && selectedLead.emailLogs.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8 mb-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <span>📧</span>
                        Email History
                      </h3>
                      <div className="space-y-4">
                        {selectedLead.emailLogs.map((log) => (
                          <div
                            key={log.id}
                            onClick={() => viewEmailContent(log)}
                            className="p-5 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-2xl">
                                    {log.direction === "outbound" ? "📤" : "📥"}
                                  </span>
                                  <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {log.subject || "(no subject)"}
                                  </span>
                                  {log.status && (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                      {log.status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 font-medium">
                                  {log.direction === "outbound" ? "To:" : "From:"}{" "}
                                  {log.direction === "outbound" ? log.to_email : log.from_email}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {log.sent_at
                                    ? new Date(log.sent_at).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : "Unknown date"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes Section */}
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span>📝</span>
                        Notes
                      </h3>
                      {!showNoteField && (
                        <button
                          onClick={() => setShowNoteField(true)}
                          className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-semibold transition-all"
                        >
                          + Add Note
                        </button>
                      )}
                    </div>

                    {showNoteField && (
                      <div className="mb-6">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Type your note here..."
                          className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          rows={3}
                        />
                        <div className="flex gap-3 mt-3">
                          <button
                            onClick={addNote}
                            className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-purple-700 shadow-lg transition-all"
                          >
                            Save Note
                          </button>
                          <button
                            onClick={() => {
                              setShowNoteField(false);
                              setNoteText("");
                            }}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {selectedLead.notes.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 mx-auto mb-4 bg-linear-to-br from-gray-100 to-blue-100 rounded-2xl flex items-center justify-center">
                            <span className="text-4xl">📝</span>
                          </div>
                          <p className="text-gray-500">No notes yet. Add one to get started.</p>
                        </div>
                      ) : (
                        selectedLead.notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-5 bg-linear-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-gray-200"
                          >
                            {editingNoteId === note.id ? (
                              <div>
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={saveEditedNote}
                                    className="px-4 py-2 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditingNote}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-gray-900 mb-3 font-medium">
                                  {note.note}
                                </p>
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-500 font-medium">
                                    {new Date(note.created_at).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => startEditingNote(note)}
                                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteNote(note.id)}
                                      className="text-xs text-red-600 hover:text-red-700 font-semibold"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-6 bg-linear-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center">
                      <span className="text-6xl">👈</span>
                    </div>
                    <p className="text-gray-500 text-lg font-medium">
                      Select a lead to view details
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Grid View
          <div className="flex-1 overflow-y-auto p-8 bg-linear-to-br from-gray-50 via-white to-purple-50">
            {/* Multi-select controls */}
            {leads.length > 0 && (
              <div className="mb-6 flex items-center justify-between bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-gray-200/50">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.size === leads.length && leads.length > 0}
                    onChange={toggleSelectAllLeads}
                    className="w-5 h-5 rounded-lg border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                    {selectedLeadIds.size > 0
                      ? `${selectedLeadIds.size} selected`
                      : "Select all"}
                  </span>
                </label>
                {selectedLeadIds.size > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="px-6 py-3 text-sm text-white bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-xl font-semibold shadow-lg transition-all"
                  >
                    Delete Selected
                  </button>
                )}
              </div>
            )}

            {leads.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-6 bg-linear-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center">
                    <span className="text-7xl">📭</span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-2xl">
                    No inquiries yet
                  </h3>
                  <p className="text-gray-500 text-lg">
                    When someone submits a form, it will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between mb-5">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.has(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="mt-1 w-5 h-5 rounded-lg border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all cursor-pointer"
                      />
                      <span
                        className={`px-4 py-1.5 text-xs font-bold rounded-full ${
                          lead.type === "Partnership"
                            ? "bg-linear-to-r from-purple-500 to-pink-500 text-white"
                            : lead.type === "Consultation"
                            ? "bg-linear-to-r from-blue-500 to-cyan-500 text-white"
                            : "bg-linear-to-r from-green-500 to-emerald-500 text-white"
                        }`}
                      >
                        {lead.type}
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-xl mb-2 group-hover:text-blue-600 transition-colors">
                      {lead.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1 font-medium">{lead.email}</p>
                    {lead.company && (
                      <p className="text-sm text-gray-500 mb-4 font-medium">
                        {lead.company}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mb-5">
                      <span
                        className={`px-3 py-1.5 text-xs font-bold rounded-full ${
                          lead.status === "new"
                            ? "bg-gray-100 text-gray-700"
                            : lead.status === "contacted"
                            ? "bg-blue-100 text-blue-700"
                            : lead.status === "qualified"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {lead.status}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold">
                        Score: {lead.score}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedLead(lead);
                        setViewMode("focus");
                      }}
                      className="w-full py-3 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg group-hover:shadow-xl"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        // Deleted Leads Tab
        <div className="flex-1 overflow-y-auto p-8 bg-linear-to-br from-gray-50 via-white to-purple-50">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h2 className="text-3xl font-bold bg-linear-to-r from-gray-900 to-purple-700 bg-clip-text text-transparent mb-2">
                Deleted Leads
              </h2>
              <p className="text-gray-600 text-lg">
                Restore or permanently delete leads
              </p>
            </div>

            {/* Multi-select controls */}
            {deletedLeads.length > 0 && (
              <div className="mb-6 flex items-center justify-between bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-gray-200/50">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedDeletedIds.size === deletedLeads.length && deletedLeads.length > 0}
                    onChange={toggleSelectAllDeleted}
                    className="w-5 h-5 rounded-lg border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                    {selectedDeletedIds.size > 0
                      ? `${selectedDeletedIds.size} selected`
                      : "Select all"}
                  </span>
                </label>
                {selectedDeletedIds.size > 0 && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const idsArray = Array.from(selectedDeletedIds);
                        Promise.all(
                          idsArray.map(id => 
                            supabaseBrowser
                              .from("inquiries")
                              .update({ is_deleted: false })
                              .eq("id", id)
                          )
                        ).then(() => {
                          setSelectedDeletedIds(new Set());
                          fetchLeads();
                          fetchDeletedLeads();
                        });
                      }}
                      className="px-6 py-3 text-sm text-white bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-semibold shadow-lg transition-all"
                    >
                      Restore Selected
                    </button>
                    <button
                      onClick={() => setShowBulkPermanentDeleteConfirm(true)}
                      className="px-6 py-3 text-sm text-white bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-xl font-semibold shadow-lg transition-all"
                    >
                      Permanently Delete Selected
                    </button>
                  </div>
                )}
              </div>
            )}

            {deletedLeads.length === 0 ? (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-16 text-center">
                <div className="w-32 h-32 mx-auto mb-6 bg-linear-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center">
                  <span className="text-7xl">✨</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-2xl">
                  No deleted leads
                </h3>
                <p className="text-gray-500 text-lg">
                  Deleted leads will appear here
                </p>
              </div>
            ) : (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-linear-to-r from-gray-50 to-purple-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={selectedDeletedIds.size === deletedLeads.length}
                            onChange={toggleSelectAllDeleted}
                            className="w-5 h-5 rounded-lg border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deletedLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-purple-50/50 transition-colors">
                          <td className="px-6 py-5 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedDeletedIds.has(lead.id)}
                              onChange={() => toggleDeletedSelection(lead.id)}
                              className="w-5 h-5 rounded-lg border-2 border-gray-300 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {lead.name}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="text-sm text-gray-600 font-medium">
                              {lead.email}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span
                              className={`px-3 py-1.5 text-xs font-bold rounded-full ${
                                lead.type === "Partnership"
                                  ? "bg-linear-to-r from-purple-500 to-pink-500 text-white"
                                  : lead.type === "Consultation"
                                  ? "bg-linear-to-r from-blue-500 to-cyan-500 text-white"
                                  : "bg-linear-to-r from-green-500 to-emerald-500 text-white"
                              }`}
                            >
                              {lead.type}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="text-sm text-gray-600 font-medium">
                              {lead.company || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => restoreLead(lead.id)}
                                className="px-4 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg font-semibold transition-all"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => permanentlyDeleteLead(lead.id)}
                                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-all"
                              >
                                Delete Forever
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
            <h3 className="text-2xl font-bold mb-6 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Send Email to {selectedLead.name}
            </h3>

            <input
              type="text"
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />

            <textarea
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm h-40 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Message"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-6 py-3 text-sm rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold transition-all"
                onClick={() => {
                  if (isSendingEmail) return;
                  setIsEmailModalOpen(false);
                }}
              >
                Cancel
              </button>

              <button
                className="px-6 py-3 text-sm rounded-xl bg-linear-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 font-semibold disabled:opacity-50 shadow-lg transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-8 border-b-2 border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">
                      {viewingEmail.direction === "outbound" ? "📤" : "📥"}
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {viewingEmail.subject || "(no subject)"}
                    </h2>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">
                        {viewingEmail.direction === "outbound" ? "To:" : "From:"}
                      </span>
                      <span className="font-medium">
                        {viewingEmail.direction === "outbound"
                          ? viewingEmail.to_email
                          : viewingEmail.from_email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Date:</span>
                      <span className="font-medium">
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
                      </span>
                    </div>
                    {viewingEmail.status && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold">Status:</span>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
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
                  className="p-3 hover:bg-gray-100 rounded-xl transition-all"
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
            <div className="flex-1 overflow-y-auto p-8 bg-linear-to-br from-gray-50 to-blue-50">
              {loadingEmailContent ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-gray-500 font-semibold">Loading email content...</div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 shadow-lg">
                  <div
                    className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600"
                    dangerouslySetInnerHTML={{ __html: emailContent }}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t-2 border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setViewingEmail(null);
                  setEmailContent("");
                }}
                className="px-8 py-3 bg-linear-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-3 text-gray-900">Delete Lead?</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to delete {selectedLead?.name}? You&apos;ll
              be able to recover this lead later from Deleted Leads.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteLead}
                className="flex-1 py-3 bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg transition-all"
              >
                Delete Lead
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-3 text-gray-900">Delete Multiple Leads?</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to delete {selectedLeadIds.size} lead{selectedLeadIds.size > 1 ? 's' : ''}? You&apos;ll
              be able to recover these leads later from Deleted Leads.
            </p>
            <div className="flex gap-3">
              <button
                onClick={bulkDeleteLeads}
                className="flex-1 py-3 bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg transition-all"
              >
                Delete {selectedLeadIds.size} Lead{selectedLeadIds.size > 1 ? 's' : ''}
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Permanent Delete Confirmation Modal */}
      {showBulkPermanentDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-3 text-red-600">Permanently Delete Leads?</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to permanently delete {selectedDeletedIds.size} lead{selectedDeletedIds.size > 1 ? 's' : ''}? This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={bulkPermanentlyDeleteLeads}
                className="flex-1 py-3 bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg transition-all"
              >
                Permanently Delete
              </button>
              <button
                onClick={() => setShowBulkPermanentDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
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