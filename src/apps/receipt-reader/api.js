/** The receipt reader's two calls: tries left, and reading the receipts. */
export const TOOL = "receipt-reader";

export async function fetchLimit() {
  try {
    const response = await fetch(`/api/apps/limit?tool=${TOOL}`, { credentials: "same-origin" });
    if (!response.headers.get("content-type")?.includes("application/json")) return { ready: false };
    const body = await response.json();
    return {
      ready: body.ready === true,
      triesLeft: Number(body.triesLeft) || 0,
      capReached: body.capReached === true,
    };
  } catch {
    return { ready: false };
  }
}

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
