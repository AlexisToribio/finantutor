import { describe, expect, it } from "vitest";

import { AUTH_PASSWORD_RULES, toLoginError } from "./messages";

describe("toLoginError", () => {
  it("describes every Cognito password requirement", () => {
    const cause = Object.assign(new Error("Password does not conform to policy"), {
      name: "InvalidPasswordException",
    });

    expect(toLoginError(cause)).toBe(AUTH_PASSWORD_RULES);
    expect(AUTH_PASSWORD_RULES).toBe(
      "La contraseña necesita al menos 8 caracteres, con minúscula, mayúscula, número y símbolo.",
    );
  });
});
