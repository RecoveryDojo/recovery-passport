import { createRoot } from "react-dom/react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const hostname = window.location.hostname;
const search = window.location.search;

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const shouldRegisterSW =
  import.meta.env.PROD &&
  !isInIframe &&
  !hostname.startsWith("id-preview--") &&
  !hostname.startsWith("preview--") &&
  hostname !== "lovableproject.com" &&
  !hostname.endsWith(".lovableproject.com") &&
  hostname !== "lovableproject-dev.com" &&
  !hostname.endsWith(".lovableproject-dev.com") &&
  hostname !== "beta.lovable.dev" &&
  !hostname.endsWith(".beta.lovable.dev") &&
  !search.includes("sw=off");

if (shouldRegisterSW) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
  });
} else {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations
      .filter((r) => r.scope && new URL(r.scope).pathname === "/")
      .forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
