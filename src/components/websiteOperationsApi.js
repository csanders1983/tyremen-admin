import { auth } from "../firebase";
export async function websitePost(name, body = {}) {
  if (!auth.currentUser) throw new Error("Please sign in again.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`https://us-central1-tyremen-system.cloudfunctions.net/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Request failed");
  return data;
}
