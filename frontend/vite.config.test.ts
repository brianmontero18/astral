import assert from "node:assert/strict";
import test from "node:test";
import viteConfig from "./vite.config";

const authProxy = viteConfig.server?.proxy?.["/auth"];

test("auth dev server keeps a fixed port to avoid SuperTokens origin drift", () => {
  assert.equal(viteConfig.server?.port, 5173);
  assert.equal(viteConfig.server?.strictPort, true);
});

test("HTML navigations to /auth stay on the frontend shell", () => {
  assert.equal(typeof authProxy, "object");
  assert.equal(typeof authProxy?.bypass, "function");

  assert.equal(
    authProxy?.bypass?.({
      url: "/auth",
      headers: { accept: "text/html" },
    } as never),
    "/index.html",
  );

  assert.equal(
    authProxy?.bypass?.({
      url: "/auth/?redirectToPath=",
      headers: { accept: "text/html,application/xhtml+xml" },
    } as never),
    "/index.html",
  );
});

test("auth API requests still proxy to the backend", () => {
  assert.equal(typeof authProxy, "object");
  assert.equal(typeof authProxy?.bypass, "function");

  assert.equal(
    authProxy?.bypass?.({
      url: "/auth/session/refresh",
      headers: { accept: "*/*" },
    } as never),
    undefined,
  );
});
