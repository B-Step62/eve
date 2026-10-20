import { EVE_HEALTH_ROUTE_PATH } from "#protocol/routes.js";

/**
 * `eve start` passes a per-launch token to its built server under this
 * environment variable, and the server stamps it on every health-path
 * response in {@link EVE_START_TOKEN_HEADER}, so `eve start` can tell its
 * own server from another process on the same port.
 */
export const EVE_START_TOKEN_ENV = "EVE_START_TOKEN";

export const EVE_START_TOKEN_HEADER = "x-eve-start-token";

interface NitroAppLike {
  readonly hooks: {
    hook(name: "response", handler: (response: Response, event: { req: Request }) => void): unknown;
  };
}

/**
 * Stamps at the host rather than in the eve channel's health route, because
 * apps can replace or disable that channel. A missing or replaced route
 * still answers on the health path, with this header.
 */
export default function startTokenPlugin(nitroApp: NitroAppLike): void {
  const startToken = process.env[EVE_START_TOKEN_ENV];
  if (startToken === undefined) {
    return;
  }

  nitroApp.hooks.hook("response", (response, event) => {
    if (new URL(event.req.url).pathname === EVE_HEALTH_ROUTE_PATH) {
      response.headers.set(EVE_START_TOKEN_HEADER, startToken);
    }
  });
}
