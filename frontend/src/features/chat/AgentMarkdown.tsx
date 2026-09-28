import Markdown from "react-markdown";

type Props = {
  text: string;
};

export function AgentMarkdown({ text }: Props) {
  return (
    <div className="md">
      <Markdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
