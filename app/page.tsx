"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";

interface DuplicateGroup {
  email: string;
  count: number;
  inquiries: any[];
  latestDate: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    week: 0,
    partnerships: 0,
    consultations: 0,
    newsletters: 0,
    deleted: 0
  });
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();

    // Set up real-time subscription to refresh dashboard when inquiries change
    const channel = supabaseBrowser
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch active inquiries
      const { data: activeData, error: activeError } = await supabaseBrowser
        .from("inquiries")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (activeError) throw activeError;

      // Fetch deleted inquiries
      const { data: deletedData, error: deletedError } = await supabaseBrowser
        .from("inquiries")
        .select("*")
        .eq("is_deleted", true)
        .order("created_at", { ascending: false });

      if (deletedError) throw deletedError;

      if (activeData) {
        // Calculate stats
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const partnerships = activeData.filter(i => i.page?.includes('partnership')).length;
        const consultations = activeData.filter(i => i.page?.includes('consultation')).length;
        const newsletters = activeData.filter(i => i.page?.includes('newsletter')).length;

        setStats({
          total: activeData.length,
          today: activeData.filter(i => new Date(i.created_at) >= today).length,
          week: activeData.filter(i => new Date(i.created_at) >= weekAgo).length,
          partnerships,
          consultations,
          newsletters,
          deleted: deletedData?.length || 0
        });

        // Get recent 5
        setRecentInquiries(activeData.slice(0, 5).map(item => ({
          id: item.id,
          name: item.form?.name || item.form?.full_name || "Unknown",
          type: item.page?.includes('partnership') ? 'Partnership' :
                item.page?.includes('consultation') ? 'Consultation' : 
                'Newsletter',
          time: getTimeAgo(item.created_at),
          email: item.form?.email
        })));

        // Detect duplicates by email
        const emailMap: Record<string, any[]> = {};
        activeData.forEach(item => {
          const email = item.form?.email?.toLowerCase();
          if (email) {
            if (!emailMap[email]) emailMap[email] = [];
            emailMap[email].push(item);
          }
        });

        const duplicateGroups: DuplicateGroup[] = [];
        Object.entries(emailMap).forEach(([email, items]) => {
          if (items.length > 1) {
            duplicateGroups.push({
              email,
              count: items.length,
              inquiries: items.sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ),
              latestDate: items[0].created_at
            });
          }
        });

        setDuplicates(duplicateGroups.sort((a, b) => b.count - a.count));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const mergeDuplicates = async (email: string, keepId: string, removeIds: string[]) => {
    try {
      // Mark duplicates as deleted (soft delete)
      const { error } = await supabaseBrowser
        .from("inquiries")
        .update({ is_deleted: true })
        .in("id", removeIds);

      if (error) throw error;

      // Refresh data
      fetchDashboardData();
    } catch (err) {
      console.error("Error merging duplicates:", err);
    }
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        
        {/* Header with Quick Actions */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back to EMOR OS</p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-3">
            <Link 
              href="/email-bots"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>🤖</span>
              Email Bots
            </Link>
            {stats.deleted > 0 && (
              <Link
                href="/inquiries?tab=settings"
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <span>♻️</span>
                Restore Leads ({stats.deleted})
              </Link>
            )}
            {duplicates.length > 0 && (
              <button
                onClick={() => setShowDuplicatesModal(true)}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <span>⚠️</span>
                {duplicates.length} Duplicate{duplicates.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Inquiries</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stats.today}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📈</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">This Week</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{stats.week}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📅</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Type Breakdown */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Partnerships</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                High Value
              </span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.partnerships}</p>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500"
                style={{ width: `${stats.total > 0 ? (stats.partnerships / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Consultations</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                Qualified
              </span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.consultations}</p>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500"
                style={{ width: `${stats.total > 0 ? (stats.consultations / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Newsletters</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                Nurture
              </span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stats.newsletters}</p>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500"
                style={{ width: `${stats.total > 0 ? (stats.newsletters / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Inquiries</h2>
              <Link href="/inquiries" className="text-sm text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentInquiries.length > 0 ? (
              <div className="space-y-4">
                {recentInquiries.map(inquiry => (
                  <div key={inquiry.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm">
                          {inquiry.type === 'Partnership' ? '🤝' :
                           inquiry.type === 'Consultation' ? '💼' : '📧'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{inquiry.name}</p>
                        <p className="text-sm text-gray-500">{inquiry.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        inquiry.type === 'Partnership' ? 'bg-green-100 text-green-700' :
                        inquiry.type === 'Consultation' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {inquiry.type}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{inquiry.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No recent inquiries</p>
            )}
          </div>
        </div>
      </div>

      {/* Duplicates Modal */}
      {showDuplicatesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Duplicate Email Detection</h2>
                <p className="text-sm text-gray-500 mt-1">Found {duplicates.length} email(s) with multiple submissions</p>
              </div>
              <button
                onClick={() => setShowDuplicatesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {duplicates.map((group, idx) => (
                  <div key={idx} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{group.email}</p>
                        <p className="text-sm text-gray-600">{group.count} submissions found</p>
                      </div>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                        Duplicate
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {group.inquiries.map((inquiry, inquiryIdx) => (
                        <div key={inquiry.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {inquiry.form?.name || inquiry.form?.full_name || "Unknown"} 
                              {inquiryIdx === 0 && <span className="ml-2 text-xs text-green-600">(Most Recent)</span>}
                            </p>
                            <p className="text-xs text-gray-500">
                              {inquiry.page?.includes('partnership') ? 'Partnership' :
                               inquiry.page?.includes('consultation') ? 'Consultation' : 'Newsletter'}
                              {" • "}
                              {new Date(inquiry.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {inquiryIdx > 0 && (
                            <button
                              onClick={() => mergeDuplicates(
                                group.email, 
                                group.inquiries[0].id, 
                                [inquiry.id]
                              )}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {group.inquiries.length > 1 && (
                      <button
                        onClick={() => {
                          const keepId = group.inquiries[0].id;
                          const removeIds = group.inquiries.slice(1).map(i => i.id);
                          mergeDuplicates(group.email, keepId, removeIds);
                        }}
                        className="mt-3 w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Keep Latest & Remove {group.inquiries.length - 1} Duplicate{group.inquiries.length - 1 > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowDuplicatesModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}