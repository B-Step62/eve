import { getVercelOidcToken } from "@vercel/oidc";
import type { BetterAuthPlugin } from "better-auth";
import { validateAuthorizationCode } from "better-auth/oauth2";

// Bridge for Better Auth 1.6.x. Replace with the built-in Vercel tokenEndpointAuth
// option after https://github.com/better-auth/better-auth/pull/11948 is released.
export function vercelOidcClientAuthentication(clientId: string): BetterAuthPlugin {
  return {
    id: "vercel-oidc-client-authentication",
    init(context) {
      return {
        context: {
          socialProviders: context.socialProviders.map((provider) =>
            provider.id !== "vercel"
              ? provider
              : {
                  ...provider,
                  async validateAuthorizationCode(data) {
                    const assertion = await getVercelOidcToken();
                    if (!assertion) throw new Error("Vercel workload OIDC token is unavailable");
                    return validateAuthorizationCode({
                      ...data,
                      options: { clientId },
                      tokenEndpoint: "https://api.vercel.com/login/oauth/token",
                      additionalParams: {
                        client_assertion: assertion,
                        client_assertion_type:
                          "urn:vercel:params:oauth:client-assertion-type:oidc-bearer",
                      },
                    });
                  },
                },
          ),
        },
      };
    },
  };
}
