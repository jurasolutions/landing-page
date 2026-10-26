/** The receipt reader's two calls: tries left, and reading the receipts. */
import { fetchLimit as fetchToolLimit } from "../_shared/ai-limit.js";

export const TOOL = "receipt-reader";

export const fetchLimit = () => fetchToolLimit(TOOL);

/** Returns { status, body }; status 0 when the network failed. */
export async function sendReceipts(blobs, token) {
  const form = new FormData();
  form.append("token", token);
  blobs.forEach((blob, index) => form.append("files", blob, `receipt-${index + 1}.jpg`));
  try {
    const response = await fetch(`/api/apps/${TOOL}`, { method: "POST", body: form, credentials: "same-origin" });
    const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
    return { status: response.status, body };
  } catch {
    return { status: 0, body: {} };
  }
}
