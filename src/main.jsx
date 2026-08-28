import React from "react";
import { createRoot } from "react-dom/client";

import "./design-system/styles.css";
import "./styles/site.css";
import "./styles/motion-sequencing.css";

import { registerIcons } from "./lib/icons.js";
import App from "./App.jsx";

registerIcons();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
