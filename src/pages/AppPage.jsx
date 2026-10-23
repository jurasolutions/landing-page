import React from "react";
import { Alert, Icon } from "../ds.js";
import { APP_SHELL } from "../content.js";
import { REGISTRY, findApp } from "../apps/registry.js";
import { copyFor, lazyTool } from "../apps/loaders.js";
import { AppShell } from "../apps/_shared/AppShell.jsx";
import { useMeta } from "../lib/meta.js";
import { NotFound } from "./NotFound.jsx";
import "../styles/toolbox.css";

/** Catches a tool chunk that fails to download, so the page still explains itself. */
class ToolBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("A toolbox tool failed to load", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <Alert
          tone="danger"
          title={APP_SHELL.loadFailedTitle}
          icon={<Icon name="alert-circle" size={18} />}
        >
          {APP_SHELL.loadFailedBody}
        </Alert>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <p className="tb-loading" role="status">
      {APP_SHELL.loading}
    </p>
  );
}

/**
 * /apps/<slug>. A tool is shown when it is in the registry, has a folder with
 * an index.jsx, and is live. Drafts open only on the local dev server, so a
 * tool can be built and checked before its registry entry says live.
 */
export function AppPage({ slug, registry = REGISTRY, allowDrafts = import.meta.env.DEV }) {
  const app = findApp(slug, registry);
  const visible = app && (app.status === "live" || allowDrafts);
  const copy = visible ? (copyFor(slug) ?? { title: app.name, subtitle: app.description }) : null;
  const Tool = visible ? lazyTool(slug) : null;

  useMeta(
    visible
      ? {
          path: `/apps/${slug}`,
          title: APP_SHELL.metaTitle(copy.title),
          description: copy.subtitle,
          noindex: app.status !== "live",
        }
      : null
  );

  if (!visible || !Tool) return <NotFound />;

  return (
    <AppShell app={app} copy={copy}>
      <ToolBoundary>
        <React.Suspense fallback={<Loading />}>
          <Tool app={app} copy={copy} />
        </React.Suspense>
      </ToolBoundary>
    </AppShell>
  );
}

export default function AppPageRoute(props) {
  // Keyed by slug so moving between tools starts each one fresh.
  return <AppPage key={props.slug} {...props} />;
}
