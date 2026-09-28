import { NavLink } from "react-router-dom";

export function TabNav() {
  return (
    <nav className="tabs" aria-label="Secciones">
      <NavLink to="/" className={({ isActive }) => (isActive ? "tab active" : "tab")} end>
        Tutor
      </NavLink>
      <NavLink
        to="/materiales"
        className={({ isActive }) => (isActive ? "tab active" : "tab")}
      >
        Subir material
      </NavLink>
    </nav>
  );
}
