import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import "katex/dist/katex.min.css";

type Props = {
  text: string;
};

function normalizeDisplayMath(text: string) {
  return text.replace(
    /^\s*\$\$(.+)\$\$\s*$/gm,
    (_match, expression: string) => `$$\n${expression.trim()}\n$$`,
  );
}

export function AgentMarkdown({ text }: Props) {
  return (
    <div className="md">
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {normalizeDisplayMath(text)}
      </Markdown>
    </div>
  );
}
