import { getSession } from "@/lib/session";
import { logoutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div>
      <div className="command-bar">
        <div className="command-bar__brand">
          <span className="dot" />
          <span className="command-bar__title">Command Center</span>
        </div>
        <div className="command-bar__meta">
          {session?.email}
          <form action={logoutAction} style={{ display: "inline" }}>
            <button
              type="submit"
              className="secondary"
              style={{ marginLeft: 16, padding: "4px 10px", fontSize: 13 }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div className="page">{children}</div>
    </div>
  );
}
