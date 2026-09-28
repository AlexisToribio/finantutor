import { describe, expect, it } from "vitest";

import { acceptsJsonBody } from "./http";

describe("acceptsJsonBody", () => {
  it("accepts JSON and the octet-stream Lambda streaming leaves behind", () => {
    expect(acceptsJsonBody("application/json")).toBe(true);
    expect(acceptsJsonBody("application/json; charset=utf-8")).toBe(true);
    expect(acceptsJsonBody("application/octet-stream")).toBe(true);
    expect(acceptsJsonBody("")).toBe(true);
  });

  it("rejects the chat stream", () => {
    expect(acceptsJsonBody("text/event-stream; charset=utf-8")).toBe(false);
  });
});
