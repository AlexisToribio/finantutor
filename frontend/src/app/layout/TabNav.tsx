type Tab = "chat" | "materials";

export function TabNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Array<[Tab, string, string]> = [
    ["chat", "01", "Conversar"],
    ["materials", "02", "Sílabo y materiales"],
  ];
  return (
    <nav aria-label="Secciones del cuaderno">
      {tabs.map(([id, number, label]) => (
        <button key={id} className={active === id ? "active" : ""} onClick={() => onChange(id)}>
          <span>{number}</span>{label}
        </button>
      ))}
    </nav>
  );
}
