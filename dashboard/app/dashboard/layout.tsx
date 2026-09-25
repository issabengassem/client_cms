import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <div className="app-shell">
    <aside className="app-sidebar">
      <Link className="sidebar-brand" href="/dashboard"><span className="brand-mark">C</span><span>Command Center<small>CONTENT WORKSPACE</small></span></Link>
      <div className="sidebar-group-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="sidebar-nav"><Link href="/dashboard">▦ <span>Overview</span></Link><Link href="/dashboard#sites">▤ <span>Sites</span></Link><Link href="/dashboard/activity">◷ <span>Activity</span></Link>{session.role === "admin" && <Link href="/dashboard/users">◉ <span>Users</span></Link>}</nav>
      <div className="sidebar-bottom"><div className="sidebar-account"><span className="account-avatar">{session?.email?.charAt(0).toUpperCase() ?? "?"}</span><div><strong>{session?.email ?? "Operator"}</strong><small>{session?.role ?? ""}</small></div></div><form action={logoutAction}><button type="submit" className="sidebar-signout">Sign out</button></form></div>
    </aside>
    <div className="app-main"><div className="topbar"><span>Content management</span><span className="topbar-status"><span /> Workspace</span></div><main className="page">{children}</main></div>
  </div>;
}
