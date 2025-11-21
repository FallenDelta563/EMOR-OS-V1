import DashboardLayout from "./dashboard-wrapper";

export default function Template({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}