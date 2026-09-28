import { describe, expect, it } from "vitest";

import { responseHeaders } from "../src/infrastructure/http/response-headers.js";

describe("responseHeaders", () => {
  it("writes Content-Type with the casing Lambda response streaming recognizes", () => {
    const headers = responseHeaders(
      { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
      "application/json",
    );
    expect(headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(headers["content-type"]).toBeUndefined();
    expect(headers["access-control-allow-origin"]).toBe("*");
  });

  it("defaults to application/json when Express omits the type", () => {
    expect(responseHeaders({}, "application/json")["Content-Type"]).toBe("application/json");
  });
});
