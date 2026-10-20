import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { getVercelOidcToken } from "@vercel/oidc";

vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: vi.fn() }));
const moduleUrl = new URL(
  "../../../../../../apps/docs/registry/channel/web-sign-in-with-vercel/lib/vercel-oidc.ts",
  import.meta.url,
).href;
const { vercelOidcClientAuthentication } = (await import(/* @vite-ignore */ moduleUrl)) as {
  vercelOidcClientAuthentication: (clientId: string) => BetterAuthPlugin;
};
const requests: URLSearchParams[] = [];
function createAuth() {
  return betterAuth({
    baseURL: "http://localhost:3000",
    secret: "test-session-secret-with-at-least-thirty-two-characters",
    socialProviders: { vercel: { clientId: "cl_test" } },
    plugins: [vercelOidcClientAuthentication("cl_test")],
  });
}
beforeEach(() => {
  requests.length = 0;
  vi.mocked(getVercelOidcToken).mockReset().mockResolvedValue("current-workload-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      requests.push(new URLSearchParams(String(init?.body)));
      return Response.json({ access_token: "user-token", token_type: "Bearer", expires_in: 3600 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("generated Vercel OIDC client authentication", () => {
  it("keeps the built-in callback and PKCE, and reads a current token for every exchange", async () => {
    const auth = createAuth();
    const context = await auth.$context;
    const provider = context.socialProviders.find((provider) => provider.id === "vercel")!;
    const data = {
      code: "user-code",
      codeVerifier: "pkce-verifier",
      redirectURI: "http://localhost:3000/api/auth/callback/vercel",
    };
    const authorize = await provider.createAuthorizationURL({ ...data, state: "test-state" });
    expect(authorize.searchParams.get("redirect_uri")).toBe(data.redirectURI);
    expect(authorize.searchParams.get("state")).toBe("test-state");
    expect(authorize.searchParams.get("code_challenge")).toBeTruthy();
    expect(authorize.searchParams.has("client_assertion")).toBe(false);
    expect(getVercelOidcToken).not.toHaveBeenCalled();
    vi.mocked(getVercelOidcToken)
      .mockResolvedValueOnce("first-token")
      .mockResolvedValueOnce("renewed-token");
    await provider.validateAuthorizationCode(data);
    await provider.validateAuthorizationCode(data);
    expect(requests.map((body) => body.get("client_assertion"))).toEqual([
      "first-token",
      "renewed-token",
    ]);
    for (const body of requests) {
      expect(body.get("client_id")).toBe("cl_test");
      expect(body.get("client_assertion_type")).toBe(
        "urn:vercel:params:oauth:client-assertion-type:oidc-bearer",
      );
      expect(body.get("code_verifier")).toBe(data.codeVerifier);
      expect(body.get("redirect_uri")).toBe(data.redirectURI);
      expect(body.has("client_secret")).toBe(false);
    }
  });
  it("stops the exchange when workload token retrieval fails", async () => {
    const context = await createAuth().$context;
    vi.mocked(getVercelOidcToken).mockRejectedValue(new Error("OIDC unavailable"));
    await expect(
      context.socialProviders[0]!.validateAuthorizationCode({
        code: "code",
        redirectURI: "http://localhost:3000/api/auth/callback/vercel",
      }),
    ).rejects.toThrow("OIDC unavailable");
    expect(requests).toEqual([]);
  });
});

it("creates a user session through the existing Vercel callback", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url) === "https://api.vercel.com/login/oauth/userinfo") {
        return Response.json({
          sub: "vercel-user",
          email: "person@example.com",
          email_verified: true,
          name: "Person",
        });
      }
      expect(String(url)).toBe("https://api.vercel.com/login/oauth/token");
      requests.push(new URLSearchParams(String(init?.body)));
      return Response.json({ access_token: "user-token", token_type: "Bearer", expires_in: 3600 });
    }),
  );
  const auth = createAuth();
  const start = await auth.api.signInSocial({
    body: { provider: "vercel", callbackURL: "/chat" },
    asResponse: true,
  });
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const authorize = new URL(url);
  const callback = new URL(authorize.searchParams.get("redirect_uri")!);
  expect(callback.pathname).toBe("/api/auth/callback/vercel");
  callback.searchParams.set("state", authorize.searchParams.get("state")!);
  callback.searchParams.set("code", "user-code");
  const cookie = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  const response = await auth.handler(
    new Request(callback, { headers: { cookie: cookie(start) } }),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/chat");
  const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie(response) }) });
  expect(session?.user.email).toBe("person@example.com");
  expect(session?.user.emailVerified).toBe(true);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.get("client_assertion")).toBe("current-workload-token");
});
