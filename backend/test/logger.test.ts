import { describe, expect, it, vi } from "vitest";

import { errorMessage, errorName, logger } from "../src/infrastructure/observability/logger.js";

describe("logger", () => {
  it("writes a JSON info line with service, level and event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("books.uploads.received", { filename: "material.pdf" });
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toEqual({
      service: "bff",
      level: "info",
      event: "books.uploads.received",
      filename: "libro.pdf",
    });
    spy.mockRestore();
  });

  it("writes failures to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("books.uploads.failed", { error: "AccessDenied" });
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toMatchObject({
      level: "error",
      event: "books.uploads.failed",
    });
    spy.mockRestore();
  });

  it("reads error name and message", () => {
    const error = new TypeError("boom");
    expect(errorName(error)).toBe("TypeError");
    expect(errorMessage(error)).toBe("boom");
    expect(errorMessage("nope")).toBe("nope");
  });
});
