/**
 * The design system's `Icon` component draws from a global `window.lucide`
 * (it was written against the Lucide UMD build). We register only the icons
 * this page uses, so the bundle carries a handful of glyphs rather than the
 * whole Lucide set.
 *
 * Adding an icon to the page means adding it here too — `Icon` renders nothing
 * for a name it cannot find.
 */
import {
  createElement,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  Clock,
  DoorOpen,
  FileText,
  FolderOpen,
  KeyRound,
  LifeBuoy,
  Mail,
  Menu,
  Phone,
  Plug,
  SearchCheck,
  ShieldCheck,
  Upload,
  UserRound,
  Workflow,
  X,
} from "lucide";

const icons = {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  Clock,
  DoorOpen,
  FileText,
  FolderOpen,
  KeyRound,
  LifeBuoy,
  Mail,
  Menu,
  Phone,
  Plug,
  SearchCheck,
  ShieldCheck,
  Upload,
  UserRound,
  Workflow,
  X,
};

export function registerIcons() {
  window.lucide = { createElement, icons };
}
