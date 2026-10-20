import { betterAuth } from "better-auth";
import { vercelOidcClientAuthentication } from "./vercel-oidc";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const DEVELOPMENT_ALLOWED_HOSTS = ["localhost:*", "127.0.0.1:*"];

function getAllowedHosts(): string[] {
  if (process.env.NODE_ENV === "development") {
    return DEVELOPMENT_ALLOWED_HOSTS;
  }
  const deploymentHosts = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ].filter((host): host is string => Boolean(host));
  if (deploymentHosts.length === 0) {
    throw new Error("No trusted deployment hosts are configured");
  }
  return Array.from(new Set(deploymentHosts));
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "development") return `development-${name}`;
  throw new Error(`Missing required environment variable: ${name}`);
}

const clientId = requireEnvironmentVariable("VERCEL_APP_CLIENT_ID");
const authMethod = process.env.VERCEL_APP_AUTH_METHOD ?? "client_secret_post";
if (authMethod !== "oidc_token" && authMethod !== "client_secret_post") {
  throw new Error("Unsupported VERCEL_APP_AUTH_METHOD");
}

export const auth = betterAuth({
  plugins: authMethod === "oidc_token" ? [vercelOidcClientAuthentication(clientId)] : [],
  baseURL: {
    allowedHosts: getAllowedHosts(),
    protocol: process.env.NODE_ENV === "development" ? "auto" : "https",
  },
  secret: requireEnvironmentVariable("BETTER_AUTH_SECRET"),
  session: {
    expiresIn: SESSION_MAX_AGE_SECONDS,
    disableSessionRefresh: true,
    cookieCache: {
      enabled: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      refreshCache: false,
      strategy: "jwe",
    },
  },
  socialProviders: {
    vercel: {
      clientId,
      ...(authMethod === "client_secret_post"
        ? { clientSecret: requireEnvironmentVariable("VERCEL_APP_CLIENT_SECRET") }
        : {}),
      scope: ["openid", "email", "profile"],
    },
  },
});
