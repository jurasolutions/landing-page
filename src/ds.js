/**
 * One import point for the design system. Everything the site renders comes
 * from here — no ad-hoc components, no second icon or font set.
 *
 * `src/design-system/` is a verbatim, read-only copy of
 * `jurasolutions/design-system/`. Change it at source, then run
 * `npm run sync:ds`. This file lives outside that folder so the sync can
 * replace it wholesale.
 */
export { Logo } from "./design-system/components/brand/Logo.jsx";
export { Icon } from "./design-system/components/brand/Icon.jsx";

export { Button } from "./design-system/components/core/Button.jsx";
export { IconButton } from "./design-system/components/core/IconButton.jsx";
export { Card } from "./design-system/components/core/Card.jsx";
export { Badge } from "./design-system/components/core/Badge.jsx";
export { Tag } from "./design-system/components/core/Tag.jsx";

export { Field } from "./design-system/components/forms/Field.jsx";
export { Input, Textarea } from "./design-system/components/forms/Input.jsx";
export { Select } from "./design-system/components/forms/Select.jsx";
export { Checkbox, Radio, Switch } from "./design-system/components/forms/Choice.jsx";

export { Alert } from "./design-system/components/feedback/Alert.jsx";
export { Toast } from "./design-system/components/feedback/Toast.jsx";

export { Tabs } from "./design-system/components/navigation/Tabs.jsx";
export { Accordion } from "./design-system/components/navigation/Accordion.jsx";

export { ImagePlaceholder } from "./design-system/components/media/ImagePlaceholder.jsx";

export { MotionPanel } from "./design-system/components/motion/MotionPanel.jsx";
export { AutomationFlow } from "./design-system/components/motion/AutomationFlow.jsx";
export { DocumentPipeline } from "./design-system/components/motion/DocumentPipeline.jsx";
export { ApprovalTrack } from "./design-system/components/motion/ApprovalTrack.jsx";
export { LiveDashboard } from "./design-system/components/motion/LiveDashboard.jsx";
export { IntegrationWeb } from "./design-system/components/motion/IntegrationWeb.jsx";
export { EffortMeter } from "./design-system/components/motion/EffortMeter.jsx";
