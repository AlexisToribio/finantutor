import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatPanel } from "./ChatPanel";

describe("ChatPanel", () => {
  it("shows a disabled new-conversation action while hydrating", () => {
    const html = renderToStaticMarkup(
      <ChatPanel sessionId="session-1" onNewConversation={() => undefined} />,
    );

    expect(html).toContain("Nueva conversación");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Nueva conversación<\/button>/);
  });
});
