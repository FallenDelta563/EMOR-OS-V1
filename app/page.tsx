"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    week: 0,
    partnerships: 0,
    consultations: 0,
    newsletters: 0
  });
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabaseBrowser
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        // Calculate stats
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const partnerships = data.filter(i => i.page?.includes('partnership')).length;
        const consultations = data.filter(i => i.page?.includes('consultation')).length;
        const newsletters = data.filter(i => i.page?.includes('newsletter')).length;

        setStats({
          total: data.length,
          today: data.filter(i => new Date(i.created_at) >= today).length,
          week: data.filter(i => new Date(i.created_at) >= weekAgo).length,
          partnerships,
          consultations,
          newsletters
        });

        // Get recent 5
        setRecentInquiries(data.slice(0, 5).map(item => ({
          id: item.id,
          name: item.form?.name || item.form?.full_name || "Unknown",
          type: item.page?.includes('partnership') ? 'Partnership' :
                item.page?.includes('consultation') ? 'Consultation' : 
                'Newsletter',
          time: getTimeAgo(item.created_at),
          email: item.form?.email
        })));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
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
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back to EMOR OS</p>
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
                style={{ width: `${(stats.partnerships / stats.total) * 100}%` }}
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
                style={{ width: `${(stats.consultations / stats.total) * 100}%` }}
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
                style={{ width: `${(stats.newsletters / stats.total) * 100}%` }}
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
    </div>
  );
}