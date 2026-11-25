import { describe, expect, it } from "vitest";
import { failureText, trapIndex } from "../../frontend/src/shell/failure";

describe("failure wording", () => {
  it("offers Try again when loading failed", () => {
    expect(failureText({ kind: "network", detail: "404" }).retry).toBe("Try again");
    expect(failureText({ kind: "state", detail: "x" }).retry).toBe("Try again");
  });

  it("does not retry a failed command, which could repeat an action", () => {
    expect(failureText({ kind: "command", detail: "Not allowed" }).retry).toBeNull();
  });

  it("always says that nothing was changed", () => {
    for (const kind of ["network", "state", "command"] as const) {
      expect(failureText({ kind, detail: "x" }).body).toContain("Nothing was changed.");
    }
  });

  it("ends the core's reason with one full stop", () => {
    expect(failureText({ kind: "command", detail: "Not allowed" }).body).toBe("Not allowed. Nothing was changed.");
    expect(failureText({ kind: "command", detail: "Not allowed." }).body).toBe("Not allowed. Nothing was changed.");
  });
});

describe("focus trap", () => {
  it("wraps forwards and backwards", () => {
    expect(trapIndex(2, 3, false)).toBe(0);
    expect(trapIndex(0, 3, true)).toBe(2);
    expect(trapIndex(1, 3, false)).toBe(2);
  });

  it("starts at an end when focus is outside the trap", () => {
    expect(trapIndex(-1, 3, false)).toBe(0);
    expect(trapIndex(-1, 3, true)).toBe(2);
    expect(trapIndex(0, 0, false)).toBe(-1);
  });
});
