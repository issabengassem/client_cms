"use client";

import { useActionState } from "react";
import { createSiteAction, type CreateSiteState } from "./actions";

const initialState: CreateSiteState = {};

export default function CreateSiteForm() {
  const [state, formAction, pending] = useActionState(createSiteAction, initialState);

  if (state.createdKey) {
    const { name, siteId, apiKey, revalidateSecret } = state.createdKey;
    return (
      <div className="card">
        <h2>{name} registered</h2>
        <p className="subtle" style={{ marginBottom: 14 }}>
          Save these now. The API key is shown once and cannot be recovered later.
        </p>
        <div className="key-reveal" style={{ marginBottom: 10 }}>
          site id&nbsp;&nbsp;{siteId}
          <br />
          api key&nbsp;&nbsp;&nbsp;{apiKey}
          <br />
          revalidate secret&nbsp;&nbsp;{revalidateSecret}
        </div>
        <p className="subtle">
          These three values are exactly what the onboarding Skill writes into the client project&rsquo;s{" "}
          <code className="mono">.env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Register a site</h2>
      <p className="subtle" style={{ marginBottom: 16 }}>
        Usually the onboarding Skill does this for you. This form is here for registering a site by hand.
      </p>
      <form className="stacked" action={formAction}>
        <div>
          <label htmlFor="name">Site name</label>
          <input id="name" name="name" type="text" placeholder="Atlas Barbershop" required />
        </div>
        <div>
          <label htmlFor="domain">Domain</label>
          <input id="domain" name="domain" type="text" placeholder="atlasbarbershop.com" required />
        </div>
        <div>
          <label htmlFor="revalidateUrl">Revalidate URL (optional, can add later)</label>
          <input
            id="revalidateUrl"
            name="revalidateUrl"
            type="url"
            placeholder="https://atlasbarbershop.vercel.app/api/revalidate"
          />
        </div>
        {state.error && <p className="error-text">{state.error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Registering..." : "Register site"}
        </button>
      </form>
    </div>
  );
}
