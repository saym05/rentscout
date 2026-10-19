import { Link, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Empty } from "./components/States";
import { ComparePage } from "./pages/ComparePage";
import { LandingPage } from "./pages/LandingPage";
import { ListingFormPage } from "./pages/ListingFormPage";
import { ListingPage } from "./pages/ListingPage";
import { SavedPage } from "./pages/SavedPage";
import { SearchPage } from "./pages/SearchPage";
import { SourcesPage } from "./pages/SourcesPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="listings/new" element={<ListingFormPage />} />
        <Route path="listings/:id" element={<ListingPage />} />
        <Route path="listings/:id/edit" element={<ListingFormPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="*" element={<Empty title="Page not found"><Link className="btn" to="/">Go home</Link></Empty>} />
      </Route>
    </Routes>
  );
}
