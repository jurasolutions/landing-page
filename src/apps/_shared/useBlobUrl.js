import React from "react";

/**
 * An object URL for `blob` that lives exactly as long as the component
 * showing it: made when the blob arrives, released when it changes or the
 * component goes. Nothing has to remember to revoke it, so a photo removed
 * while it is still being prepared can't leave a URL behind.
 * Returns "" until the URL exists (and always during server rendering).
 */
export function useBlobUrl(blob) {
  const [url, setUrl] = React.useState("");
  React.useEffect(() => {
    if (!blob) return undefined;
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => {
      URL.revokeObjectURL(made);
      setUrl("");
    };
  }, [blob]);
  return url;
}
