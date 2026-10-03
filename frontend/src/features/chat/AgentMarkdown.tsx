import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
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

function normalizeEmojiLists(text: string) {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const markers = trimmed.match(/✅|⚠️?/gu);
      if (!/^(?:✅|⚠️?)/u.test(trimmed) || !markers || markers.length < 2) {
        return line;
      }

      const items = trimmed
        .split(/(?=✅|⚠️?)/u)
        .map((item) => item.trim())
        .filter(Boolean);
      return `\n${items.map((item) => `- ${item}`).join("\n")}\n`;
    })
    .join("\n");
}

export function AgentMarkdown({ text }: Props) {
  return (
    <div className="md">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
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
        {normalizeEmojiLists(normalizeDisplayMath(text))}
      </Markdown>
    </div>
  );
}
