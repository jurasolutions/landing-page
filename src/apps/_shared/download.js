/** Hands the visitor a file made in the browser. Nothing leaves the device. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari needs the URL to outlive the click briefly.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Makes a string safe to use as part of a file name. */
export function safeFilename(value, fallback) {
  const cleaned = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}
