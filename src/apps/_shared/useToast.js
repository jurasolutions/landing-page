import React from "react";

/**
 * A short-lived message for the design system's Toast. The Toast only times
 * itself out when given onClose, which also draws a 16px close button that
 * is too small to tap; timing it here keeps the message and drops the button.
 */
export function useToast(duration = 4000) {
  const [message, setMessage] = React.useState("");
  React.useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(""), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);
  return [message, setMessage];
}
