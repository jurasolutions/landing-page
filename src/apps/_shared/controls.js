/**
 * Inline styles for the design system's form controls on tool pages. They are
 * passed as `style`, which the design system's controls apply last.
 */

/** Form controls are 42px tall in the design system; the toolbox asks for 44. */
export const TAP = { minHeight: "var(--tap-min)" };

/**
 * For the design system's Input. Without an icon it sets
 * `paddingLeft: undefined` after its `padding` shorthand, and React clears the
 * left padding, so the text sits against the border. This restates it.
 */
export const TAP_INPUT = { ...TAP, paddingLeft: "var(--space-3)" };
