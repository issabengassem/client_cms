"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import type { UserDoc } from "@/lib/types";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are both required." };
  }

  let user: UserDoc | null;
  try {
    const db = await getDb();
    user = await db.collection<UserDoc>("users").findOne({ email });
  } catch (error) {
    console.error(
      "Login could not reach MongoDB:",
      error instanceof Error ? error.name : "Unknown error"
    );
    return {
      error:
        "The dashboard cannot connect to its database. Your password has not been checked. Please try again shortly or ask your administrator to check the server connection.",
    };
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    // Deliberately the same message either way, so this can't be used to
    // enumerate which emails have accounts.
    return { error: "Invalid email or password." };
  }

  await createSession({
    userId: user._id!.toString(),
    email: user.email,
    role: user.role,
  });

  redirect("/dashboard");
}
