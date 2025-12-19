"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  name: string;
  href: string;
  icon: string;
  description: string;
  matchPrefix?: boolean;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navigation: NavItem[] = [
    {
      name: "Dashboard",
      href: "/",
      icon: "📊",
      description: "Overview & KPIs",
      matchPrefix: false, // only exact "/"
    },
    {
      name: "Inbox",
      href: "/inbox",
      icon: "📥",
      description: "Inquiries + Prospects",
      matchPrefix: true,
    },
    {
      name: "Inquiries",
      href: "/inquiries",
      icon: "📬",
      description: "All form submissions",
      matchPrefix: true,
    },
    {
      name: "Leads",
      href: "/leads",
      icon: "🚀",
      description: "Qualified prospects",
      matchPrefix: true,
    },
    {
      name: "Analytics",
      href: "/analytics",
      icon: "📈",
      description: "Performance metrics",
      matchPrefix: true,
    },
    {
      name: "Email Bots",
      href: "/email-bots",
      icon: "🤖",
      description: "Auto-reply templates",
      matchPrefix: true,
    },
  ];

  const isItemActive = (item: NavItem) => {
    if (item.href === "/") return pathname === "/";
    if (item.matchPrefix) return pathname === item.href || pathname.startsWith(item.href + "/");
    return pathname === item.href;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-80 bg-white border-r-2 border-gray-200 flex flex-col shadow-sm">
        <div className="p-8 border-b-2 border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              E
            </div>
            <div>
              <h2 className="font-bold text-xl text-gray-900 tracking-tight">EMOR OS</h2>
              <p className="text-sm text-gray-500 font-medium">Lead Intelligence System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6">
          <ul className="space-y-3">
            {navigation.map((item) => {
              const active = isItemActive(item);

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-4 px-4 py-4 rounded-xl transition-all
                      ${
                        active
                          ? "bg-blue-50 text-blue-600 border-2 border-blue-200 shadow-sm"
                          : "text-gray-600 hover:bg-gray-50 border-2 border-transparent hover:border-gray-200"
                      }
                    `}
                  >
                    <div
                      className={`
                        w-10 h-10 rounded-lg flex items-center justify-center text-xl
                        ${active ? "bg-blue-100" : "bg-gray-100"}
                      `}
                    >
                      {item.icon}
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-semibold">{item.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                    </div>

                    {active && <div className="w-1.5 h-8 bg-blue-600 rounded-full" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-6 border-t-2 border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              System Status
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700">Database Connected</p>
              <p className="text-xs text-green-600">All systems operational</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-white">{children}</main>
    </div>
  );
}
