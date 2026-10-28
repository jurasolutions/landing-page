/** What POST /api/apps/promo answered, as a message key in TOOLBOX.code. */
const MESSAGE = { 200: "accepted", 401: "wrong", 429: "tooMany" };

/**
 * Sends an access code to the Function and says how it went: "accepted",
 * "wrong", "tooMany" or "unavailable" (any other answer, or no answer). A
 * right code sets the cookie that lifts the AI try limit (server/promo.js).
 */
export async function submitCode(code) {
  try {
    const response = await fetch("/api/apps/promo", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return MESSAGE[response.status] ?? "unavailable";
  } catch {
    return "unavailable";
  }
}
