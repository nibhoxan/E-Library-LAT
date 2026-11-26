import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth";

export function Header() {
  const { reader } = useAuth();
  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Reading Room home">Reading Room<span>PUBLIC-DOMAIN LIBRARY</span></Link>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>Catalog</NavLink>
        <NavLink to="/shelf">My shelf</NavLink>
        {reader?.role === "desk" && <NavLink to="/desk">Desk</NavLink>}
      </nav>
      <Link to="/account" className="account-link">{reader ? reader.name : "Account"}</Link>
    </header>
  );
}
