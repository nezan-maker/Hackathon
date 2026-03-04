import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { installGlobalFetchTracking } from "./app/lib/promiseTracker";
import "./styles/index.css";

installGlobalFetchTracking();

createRoot(document.getElementById("root")!).render(<App />);
