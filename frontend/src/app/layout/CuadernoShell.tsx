import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  actions?: ReactNode;
};

export function CuadernoShell({ children, actions }: Props) {
  return (
    <div className="stage">
      <div className="app-frame">
        <div className="sheet">
          <header className="masthead">
            <div className="masthead-copy">
              <p className="kicker">UPC · MAESTRÍA EN INTELIGENCIA ARTIFICIAL</p>
              <h1>Finantutor</h1>
              <p className="tagline">
                Modelos financieros y evaluación de proyectos
              </p>
            </div>
            {actions ? <div className="masthead-actions">{actions}</div> : null}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
