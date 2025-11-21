"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  type: 'Partnership' | 'Consultation' | 'Newsletter';
  score: number;
  status: 'new' | 'contacted' | 'qualified' | 'converted';
  notes: string[];
  formData: any;
  created_at: string;
}

export default function InquiriesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'focus' | 'grid'>('focus');
  const [noteText, setNoteText] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
  // Initial load
  fetchLeads();

  // Load saved statuses from localStorage (keep this for now)
  const savedStatuses = localStorage.getItem("lead-statuses");
  if (savedStatuses) {
    setLeadStatuses(JSON.parse(savedStatuses));
  }

  // ✅ Realtime listener: whenever inquiries table changes, refetch
  const channel = supabaseBrowser
    .channel("inquiries-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inquiries" },
      () => {
        fetchLeads();
      }
    )
    .subscribe();

  // Cleanup on unmount
  return () => {
    supabaseBrowser.removeChannel(channel);
  };
}, []);


  const fetchLeads = async () => {
    try {
      const { data, error } = await supabaseBrowser
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching leads:", error);
        throw error;
      }

      // Load saved statuses
      const savedStatuses = localStorage.getItem('lead-statuses');
      const statusMap = savedStatuses ? JSON.parse(savedStatuses) : {};

      // Load deleted leads
      const deletedLeads = localStorage.getItem('deleted-leads');
      const deletedIds = deletedLeads ? JSON.parse(deletedLeads) : [];

      if (data && data.length > 0) {
        // Fetch all notes for these leads
const leadIds = data.map((item) => item.id);

const { data: notesData, error: notesError } = await supabaseBrowser
  .from("lead_notes")
  .select("*")
  .in("lead_id", leadIds);

if (notesError) {
  console.error("Error fetching notes:", notesError);
}

// Group notes by lead_id
const notesByLead: Record<string, string[]> = {};
(notesData || []).forEach((n) => {
  if (!notesByLead[n.lead_id]) notesByLead[n.lead_id] = [];
  notesByLead[n.lead_id].push(n.note);
});

        const processed: Lead[] = data
          .filter(item => !deletedIds.includes(item.id)) // Filter out deleted leads
          .map(item => {
            const form = item.form || {};
            
            let type: Lead['type'] = 'Newsletter';
            let score = 0;
            
            if (item.page?.includes('partnership')) {
              type = 'Partnership';
              score = 95;
            } else if (item.page?.includes('consultation')) {
              type = 'Consultation';
              score = 70;
            } else {
              score = 30;
            }
            
            if (form.company) score += 5;
            
            return {
              id: item.id,
              name: form.name || form.full_name || form.role || 'Unknown',
              email: form.email || '',
              company: form.company || '',
              phone: form.phone || '',
              type,
              score: Math.min(100, score),
              status: (statusMap[item.id] || 'new') as Lead['status'],
             notes: notesByLead[item.id] || [],

              formData: form,
              created_at: item.created_at
            };
          });
        
        setLeads(processed);
        if (processed.length > 0) {
          setSelectedLead(processed[0]);
        }
      } else {
        console.log("No inquiries found");
        setLeads([]);
      }
    } catch (err) {
      console.error("Error in fetchLeads:", err);
      setLeads([]);
    } finally {
      setLoading(false);
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
    // Update in state
    setLeads(leads.map(lead => 
      lead.id === leadId ? { ...lead, status: newStatus as Lead['status'] } : lead
    ));
    
    if (selectedLead?.id === leadId) {
      setSelectedLead({ ...selectedLead, status: newStatus as Lead['status'] });
    }

    // Save to localStorage
    const updatedStatuses = { ...leadStatuses, [leadId]: newStatus };
    setLeadStatuses(updatedStatuses);
    localStorage.setItem('lead-statuses', JSON.stringify(updatedStatuses));

    // Show success message
    const statusElement = document.getElementById(`status-saved-${leadId}`);
    if (statusElement) {
      statusElement.classList.remove('opacity-0');
      setTimeout(() => {
        statusElement.classList.add('opacity-0');
      }, 2000);
    }
  };

  const deleteLead = () => {
    if (!selectedLead) return;

    // Get current deleted leads
    const deletedLeads = localStorage.getItem('deleted-leads');
    const deletedIds = deletedLeads ? JSON.parse(deletedLeads) : [];
    
    // Add this lead to deleted list
    deletedIds.push(selectedLead.id);
    localStorage.setItem('deleted-leads', JSON.stringify(deletedIds));

    // Remove from current leads
    const updatedLeads = leads.filter(l => l.id !== selectedLead.id);
    setLeads(updatedLeads);
    
    // Select next lead if available
    if (updatedLeads.length > 0) {
      setSelectedLead(updatedLeads[0]);
    } else {
      setSelectedLead(null);
    }

    setShowDeleteConfirm(false);
  };

  const addNote = async () => {
  if (!selectedLead || !noteText.trim()) return;

  const trimmed = noteText.trim();

  // Save note to Supabase
  const { error } = await supabaseBrowser
    .from("lead_notes")
    .insert({
      lead_id: selectedLead.id,
      note: trimmed,
    });

  if (error) {
    console.error("Error saving note:", error);
    return;
  }

  // Update UI immediately
  const updatedLead = {
    ...selectedLead,
    notes: [...selectedLead.notes, trimmed],
  };

  setSelectedLead(updatedLead);
  setLeads(leads.map((l) => (l.id === selectedLead.id ? updatedLead : l)));
  setNoteText("");
  setShowNoteField(false);
};


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading leads...</div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Inquiries Yet</h2>
          <p className="text-gray-500">Form submissions will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="h-20 border-b-2 border-gray-200 flex items-center justify-between px-8 bg-gray-50">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Lead Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and qualify your inquiries</p>
          </div>
          <div className="flex bg-white rounded-xl p-1 border border-gray-200">
            <button
              onClick={() => setViewMode('focus')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'focus' 
                  ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Focus View
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'grid' 
                  ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Grid View
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex gap-8">
          <div className="text-center">
            <p className="text-2xl font-semibold text-green-600">{leads.filter(l => l.type === 'Partnership').length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Partnerships</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-blue-600">{leads.filter(l => l.type === 'Consultation').length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Consultations</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-purple-600">{leads.filter(l => l.type === 'Newsletter').length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Newsletters</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'focus' && (
          <>
            {/* Sidebar */}
            <div className="w-[420px] bg-gray-50 border-r-2 border-gray-200 overflow-y-auto">
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">All Inquiries</h3>
                <div className="space-y-3">
                  {leads.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`p-5 rounded-xl cursor-pointer transition-all ${
                        selectedLead?.id === lead.id 
                          ? 'bg-white border-2 border-blue-400 shadow-lg' 
                          : 'bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-gray-900 text-base">{lead.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{lead.email}</div>
                          {lead.company && (
                            <div className="text-sm text-gray-400 mt-0.5">{lead.company}</div>
                          )}
                        </div>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                          lead.type === 'Partnership' ? 'bg-green-100 text-green-700 border border-green-200' :
                          lead.type === 'Consultation' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          'bg-purple-100 text-purple-700 border border-purple-200'
                        }`}>
                          {lead.type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                          lead.status === 'qualified' ? 'bg-blue-100 text-blue-700' :
                          lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {lead.status}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  lead.score > 70 ? 'bg-green-500' :
                                  lead.score > 40 ? 'bg-yellow-500' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${lead.score}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-600">{lead.score}</span>
                          <span className="text-xs text-gray-400">{getTimeAgo(lead.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Detail View */}
            {selectedLead && (
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-5xl mx-auto p-8">
                  
                  {/* Lead Header */}
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 mb-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-4xl font-light text-gray-900 mb-3">{selectedLead.name}</h2>
                        <div className="space-y-2 text-gray-600">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">📧</span>
                            <span className="font-medium">{selectedLead.email}</span>
                          </div>
                          {selectedLead.phone && (
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400">📱</span>
                              <span className="font-medium">{selectedLead.phone}</span>
                            </div>
                          )}
                          {selectedLead.company && (
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400">🏢</span>
                              <span className="font-medium">{selectedLead.company}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-center p-6 bg-white rounded-xl border border-gray-200">
                        <div className="text-5xl font-light text-gray-900">{selectedLead.score}</div>
                        <div className="text-sm text-gray-500 uppercase tracking-wider mt-2">Lead Score</div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-3">
                      <button 
                        onClick={() => window.location.href = `mailto:${selectedLead.email}`}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        Send Email
                      </button>
                      <button 
                        onClick={() => setShowNoteField(!showNoteField)}
                        className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                      >
                        Add Note
                      </button>
                      <button className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                        Schedule Call
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-6 py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors ml-auto"
                      >
                        Delete Lead
                      </button>
                    </div>

                    {/* Note Field */}
                    {showNoteField && (
                      <div className="mt-6 p-5 bg-blue-50 rounded-xl border border-blue-200">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Type your note here..."
                          className="w-full p-4 border border-gray-200 rounded-lg resize-none h-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          autoFocus
                        />
                        <div className="flex gap-3 mt-4">
                          <button 
                            onClick={addNote}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                          >
                            Save Note
                          </button>
                          <button 
                            onClick={() => {
                              setShowNoteField(false);
                              setNoteText("");
                            }}
                            className="px-5 py-2.5 bg-white text-gray-600 rounded-lg hover:bg-gray-50 font-medium border border-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info Cards */}
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="p-5 bg-gray-50 rounded-xl border-2 border-gray-200">
                      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Type</div>
                      <div className="text-xl font-semibold text-gray-900 mt-2">{selectedLead.type}</div>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-xl border-2 border-gray-200 relative">
                      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Status</div>
                      <select 
                        value={selectedLead.status}
                        onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value)}
                        className="text-xl font-semibold text-gray-900 mt-2 bg-transparent border-0 focus:outline-none cursor-pointer"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                      </select>
                      <span 
                        id={`status-saved-${selectedLead.id}`}
                        className="absolute top-2 right-2 text-xs text-green-600 font-medium opacity-0 transition-opacity"
                      >
                        ✓ Saved
                      </span>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-xl border-2 border-gray-200">
                      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Created</div>
                      <div className="text-xl font-semibold text-gray-900 mt-2">{getTimeAgo(selectedLead.created_at)}</div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedLead.notes.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Notes History</h3>
                      <div className="space-y-3">
                        {selectedLead.notes.map((note, i) => (
                          <div key={i} className="p-5 bg-blue-50 rounded-xl border border-blue-200">
                            <p className="text-gray-700">{note}</p>
                            <p className="text-xs text-gray-500 mt-3">Added just now</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submission Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Submission Details</h3>
                    <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-8">
                      <div className="space-y-4">
                        {Object.entries(selectedLead.formData).map(([key, value]) => (
                          <div key={key} className="flex py-4 border-b border-gray-200 last:border-0">
                            <div className="w-1/3 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="w-2/3 text-base text-gray-900 font-medium">
                              {String(value) || '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">Delete Lead?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedLead?.name}? This action cannot be undone.
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