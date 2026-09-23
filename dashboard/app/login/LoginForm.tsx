"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="card" style={{ width: 360 }}>
      <div style={{ marginBottom: 20 }}>
        <div className="command-bar__brand" style={{ marginBottom: 10 }}>
          <span className="dot" />
          <span className="command-bar__title">Command Center</span>
        </div>
        <p className="subtle">Sign in to manage your client sites</p>
      </div>
      <form className="stacked" action={formAction}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error && <p className="error-text">{state.error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
