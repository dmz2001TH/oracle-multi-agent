import { describe, test, expect } from "bun:test";
import handler from "./index";

describe("my-plugin", () => {
  test("cli: hello", async () => {
    const r = await handler({ source: "cli", args: ["hello"] });
    expect(r.ok).toBe(true);
    expect(r.output).toContain("Hello from my-plugin!");
  });

  test("cli: info", async () => {
    const r = await handler({ source: "cli", args: ["info"] });
    expect(r.ok).toBe(true);
    expect(r.output).toContain("v0.1.0");
  });

  test("api: returns JSON", async () => {
    const r = await handler({ source: "api", args: { name: "test" } });
    expect(r.ok).toBe(true);
    expect(r.output).toContain("Hello from API!");
  });

  test("peer: echoes message", async () => {
    const r = await handler({ source: "peer", args: { message: "hi" } });
    expect(r.ok).toBe(true);
    expect(r.output).toContain("hi");
  });
});
