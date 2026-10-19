import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import type { ApiService } from "../services/ApiService";
import { MockService, type MockOptions } from "../services/mockService";
import { AppStateProvider } from "../state/AppState";

export function renderApp(path = "/", opts: MockOptions & { api?: ApiService } = {}) {
  const api = opts.api ?? new MockService(opts);
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider api={api} mode="mock"><App /></AppStateProvider>
    </MemoryRouter>,
  );
  return { api, ...utils };
}
