import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Server components call the API directly (server-to-server, no tunnel needed)
const API_URL = process.env.API_URL || "http://localhost:3001";

export async function apiFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const session = cookieStore.get("pms_session");
  const headers: HeadersInit = {};
  if (session) {
    headers.Cookie = `pms_session=${session.value}`;
  }

  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", headers });
  if (res.status === 401) {
    redirect("/login");
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
