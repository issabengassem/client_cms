import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import type { UserDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/dashboard");
  const db = await getDb();
  const users = await db.collection<UserDoc>("users").find({}, { projection: { email: 1, role: 1, createdAt: 1 } }).sort({ createdAt: -1 }).toArray();

  return <>
    <header className="page-heading"><div><span className="eyebrow">Access</span><h1>Users</h1><p className="subtle">Operator accounts currently able to sign in to the CMS.</p></div></header>
    <div className="card table-card"><div className="table-scroll"><table><thead><tr><th>Email</th><th>Role</th><th>Created</th></tr></thead><tbody>{users.map((user) => <tr key={user._id!.toString()}><td className="table-title">{user.email}</td><td><span className="badge">{user.role}</span></td><td className="subtle">{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>{users.length === 0 && <div className="empty-state">No operator accounts found.</div>}</div>
    <p className="subtle section">Account creation and role changes are not available in the dashboard yet. Existing operators have access to all sites; client-scoped permissions are not configured.</p>
  </>;
}
