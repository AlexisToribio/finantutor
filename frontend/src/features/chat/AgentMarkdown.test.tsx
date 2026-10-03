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
});
