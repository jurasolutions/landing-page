import React from "react";

import { Nav } from "./sections/Nav.jsx";
import { Footer } from "./sections/Footer.jsx";
import { Home } from "./pages/Home.jsx";
import { NAV, ROUTE_META } from "./content.js";
import { matchRoute, useLocation, interceptLinks } from "./lib/router.js";
import { useMeta } from "./lib/meta.js";

// Everything except the home page is loaded on demand, so the marketing page
// ships the same code it did before the toolbox existed.
const AppsIndex = React.lazy(() => import("./pages/AppsIndex.jsx"));
const AppPage = React.lazy(() => import("./pages/AppPage.jsx"));
const NotFound = React.lazy(() => import("./pages/NotFound.jsx"));
const Privacy = React.lazy(() => import("./pages/Privacy.jsx"));
const Unsubscribed = React.lazy(() => import("./pages/Unsubscribed.jsx"));

function Route({ route }) {
  switch (route.name) {
    case "home":
      return <Home />;
    case "apps":
      return <AppsIndex />;
    case "app":
      return <AppPage slug={route.slug} />;
    case "privacy":
      return <Privacy />;
    case "unsubscribed":
      return <Unsubscribed />;
    default:
      return <NotFound />;
  }
}

/** Keeps the shell's own pages' titles right; tool pages set their own. */
function useShellMeta(route) {
  const meta =
    route.name === "home" ? ROUTE_META.home : route.name === "apps" ? ROUTE_META.apps : null;
  useMeta(meta);
}

export default function App() {
  const { pathname } = useLocation();
  const route = matchRoute(pathname);
  useShellMeta(route);

  React.useEffect(() => interceptLinks(), []);

  return (
    <>
      <a className="skip-link" href="#main">
        {NAV.skip}
      </a>

      <Nav />

      <React.Suspense fallback={<main id="main" className="route-pending" />}>
        <Route route={route} />
      </React.Suspense>

      <Footer />
    </>
  );
}
