import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentMarkdown } from "./AgentMarkdown";

describe("AgentMarkdown", () => {
  it("renders inline and block LaTeX formulas with KaTeX", () => {
    const html = renderToStaticMarkup(
      <AgentMarkdown
        text={"Criterio: $VAN > 0$.\n\n$$VAN = -I_0 + \\sum_{t=1}^{n} \\frac{FC_t}{(1+r)^t}$$"}
      />,
    );

    expect(html).toContain("katex");
    expect(html).toContain("katex-display");
    expect(html).toContain("VAN &gt; 0");
    expect(html).toContain("\\sum_{t=1}^{n}");
    expect(html).not.toContain("$$");
  });

  it("renders GFM tables and lists", () => {
    const html = renderToStaticMarkup(
      <AgentMarkdown
        text={[
          "| Situación | VAN | TIR |",
          "| --- | --- | --- |",
          "| Proyecto rentable | VAN > 0 | TIR > r |",
          "",
          "- Fácil de interpretar",
          "- Permite comparar proyectos",
        ].join("\n")}
      />,
    );

    expect(html).toContain("<table>");
    expect(html).toContain("<th>Situación</th>");
    expect(html).toContain("<td>VAN &gt; 0</td>");
    expect(html).toContain("<ul>");
  });

  it("recovers emoji list items concatenated by the tutor", () => {
    const html = renderToStaticMarkup(
      <AgentMarkdown
        text={[
          "Ventajas de la TIR",
          "✅ Fácil de interpretar (es un porcentaje) ✅ Permite comparar proyectos de diferentes tamaños ✅ No requiere conocer previamente la tasa de descuento",
          "",
          "Limitaciones de la TIR",
          "⚠️ Puede haber múltiples TIR si los flujos cambian de signo varias veces ⚠️ No considera la escala del proyecto ⚠️ Asume que los flujos intermedios se reinvierten a la misma TIR",
        ].join("\n")}
      />,
    );

    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html.match(/<li>/g)).toHaveLength(6);
    expect(html).toContain("<li>✅ Fácil de interpretar (es un porcentaje)</li>");
    expect(html).toContain("<li>⚠️ No considera la escala del proyecto</li>");
  });
});
