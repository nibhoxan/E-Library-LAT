import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { Header } from "./shell/Header";
import { LibrarianPanel } from "./shell/LibrarianPanel";
import { CatalogScreen } from "./screens/CatalogScreen";
import { TitleScreen } from "./screens/TitleScreen";
import { ShelfScreen } from "./screens/ShelfScreen";
import { AccountScreen } from "./screens/AccountScreen";
import { DeskScreen } from "./screens/DeskScreen";

function ReadingRoom() {
  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<CatalogScreen />} />
          <Route path="/titles/:id" element={<TitleScreen />} />
          <Route path="/shelf" element={<ShelfScreen />} />
          <Route path="/account" element={<AccountScreen />} />
          <Route path="/desk" element={<DeskScreen />} />
          <Route path="*" element={<div className="page"><h1>Page not found</h1></div>} />
        </Routes>
      </main>
      <div className="page"><LibrarianPanel /></div>
      <footer className="site-footer"><span>Reading Room</span><span>A shared public-domain collection</span></footer>
    </div>
  );
}

export default function App() {
  return <BrowserRouter><AuthProvider><ReadingRoom /></AuthProvider></BrowserRouter>;
}
