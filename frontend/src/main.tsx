import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { createApiService } from "./services/createApiService";
import { AppStateProvider } from "./state/AppState";
import "./styles.css";

const { api, mode } = createApiService();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider api={api} mode={mode}><App /></AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
);
