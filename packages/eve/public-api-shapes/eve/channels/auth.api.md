# eve/channels/auth

## Export names

- AuthErrorOptions: src/channel/auth/definitions.d.ts#AuthErrorOptions
- AuthFn: src/channel/auth/definitions.d.ts#AuthFn
- AuthResult: src/channel/auth/definitions.d.ts#AuthResult
- ForbiddenError: src/channel/auth/definitions.d.ts#ForbiddenError
- HttpBasicAuthOptions: src/channel/auth/definitions.d.ts#HttpBasicAuthOptions
- HttpBasicCredentials: src/channel/auth/definitions.d.ts#HttpBasicCredentials
- IpAllowList: src/channel/auth/definitions.d.ts#IpAllowList
- OAuthResourceAuth: src/channel/auth/definitions.d.ts#OAuthResourceAuth
- OAuthResourceOptions: src/channel/auth/definitions.d.ts#OAuthResourceOptions
- UnauthenticatedError: src/channel/auth/definitions.d.ts#UnauthenticatedError
- UnauthorizedChallenge: src/channel/auth/definitions.d.ts#UnauthorizedChallenge
- UnauthorizedResponseOptions: src/channel/auth/definitions.d.ts#UnauthorizedResponseOptions
- VercelOidcOptions: src/channel/auth/definitions.d.ts#VercelOidcOptions
- VercelSubjectEnvironment: src/channel/auth/definitions.d.ts#VercelSubjectEnvironment
- VercelSubjectInput: src/channel/auth/definitions.d.ts#VercelSubjectInput
- VerifyJwtEcdsaConfig: src/channel/auth/definitions.d.ts#VerifyJwtEcdsaConfig
- VerifyJwtHmacConfig: src/channel/auth/definitions.d.ts#VerifyJwtHmacConfig
- VerifyOidcConfig: src/channel/auth/definitions.d.ts#VerifyOidcConfig
- VerifyResult: src/channel/auth/definitions.d.ts#VerifyResult
- VerifyVercelOidcOptions: src/channel/auth/definitions.d.ts#VerifyVercelOidcOptions
- createIpAllowList: src/channel/auth/definitions.d.ts#createIpAllowList
- createUnauthorizedResponse: src/channel/auth/definitions.d.ts#createUnauthorizedResponse
- extractBearerToken: src/channel/auth/definitions.d.ts#extractBearerToken
- httpBasic: src/channel/auth/definitions.d.ts#httpBasic
- isIpAllowed: src/channel/auth/definitions.d.ts#isIpAllowed
- jwtEcdsa: src/channel/auth/definitions.d.ts#jwtEcdsa
- jwtHmac: src/channel/auth/definitions.d.ts#jwtHmac
- localDev: src/channel/auth/definitions.d.ts#localDev
- none: src/channel/auth/definitions.d.ts#none
- oauthResource: src/channel/auth/definitions.d.ts#oauthResource
- oidc: src/channel/auth/definitions.d.ts#oidc
- placeholderAuth: src/channel/auth/definitions.d.ts#placeholderAuth
- routeAuth: src/channel/auth/definitions.d.ts#routeAuth
- vercelOidc: src/channel/auth/definitions.d.ts#vercelOidc
- vercelSubject: src/channel/auth/definitions.d.ts#vercelSubject
- verifyHttpBasic: src/channel/auth/definitions.d.ts#verifyHttpBasic
- verifyJwtEcdsa: src/channel/auth/definitions.d.ts#verifyJwtEcdsa
- verifyJwtHmac: src/channel/auth/definitions.d.ts#verifyJwtHmac
- verifyOidc: src/channel/auth/definitions.d.ts#verifyOidc
- verifyVercelOidc: src/channel/auth/definitions.d.ts#verifyVercelOidc
- withAuthChallenges: src/channel/auth/definitions.d.ts#withAuthChallenges

## Peer boundaries

- @types/node/net.d.ts#BlockList

## Declaration closure

### src/channel/auth/definitions.d.ts

```ts
declare const OAUTH_RESOURCE_SYMBOL: unique symbol;
export declare class ForbiddenError extends Error {
  readonly response: Response;
  constructor(opts?: AuthErrorOptions);
}
export declare class UnauthenticatedError extends Error {
  readonly response: Response;
  constructor(opts?: AuthErrorOptions);
}
export declare function createIpAllowList(entries: readonly string[]): IpAllowList;
export declare function createUnauthorizedResponse(opts?: UnauthorizedResponseOptions): Response;
export declare function extractBearerToken(authorizationHeader: string | null): string | null;
export declare function httpBasic(
  credentials: HttpBasicCredentials,
  options?: HttpBasicAuthOptions,
): AuthFn<Request>;
export declare function isIpAllowed(ip: string | null, allowList: IpAllowList): boolean;
export declare function jwtEcdsa(config: VerifyJwtEcdsaConfig): AuthFn<Request>;
export declare function jwtHmac(config: VerifyJwtHmacConfig): AuthFn<Request>;
export declare function localDev(): AuthFn<Request>;
export declare function none<TEvent = unknown>(): AuthFn<TEvent>;
export declare function oauthResource(
  auth: AuthFn<Request> | readonly AuthFn<Request>[],
  options: OAuthResourceOptions,
): OAuthResourceAuth;
export declare function oidc(config: VerifyOidcConfig): AuthFn<Request>;
export declare function placeholderAuth(): AuthFn<Request>;
export declare function routeAuth(
  request: Request,
  auth: AuthFn<Request> | readonly AuthFn<Request>[],
): Promise<AuthResult | Response>;
export declare function vercelOidc(opts?: VercelOidcOptions): AuthFn<Request>;
export declare function vercelSubject(input: VercelSubjectInput): string;
export declare function verifyHttpBasic(
  authorizationHeader: string | null,
  credentials: HttpBasicCredentials,
): VerifyResult;
export declare function verifyJwtEcdsa(
  token: string | null,
  config: VerifyJwtEcdsaConfig,
): Promise<VerifyResult>;
export declare function verifyJwtHmac(
  token: string | null,
  config: VerifyJwtHmacConfig,
): Promise<VerifyResult>;
export declare function verifyOidc(
  token: string | null,
  config: VerifyOidcConfig,
): Promise<VerifyResult>;
export declare function verifyVercelOidc(
  token: string | null,
  opts?: VerifyVercelOidcOptions,
): Promise<VerifyResult>;
export declare function withAuthChallenges<TEvent>(
  fn: AuthFn<TEvent>,
  challenges: readonly UnauthorizedChallenge[],
): AuthFn<TEvent>;
export interface AuthResult extends SessionAuthContext {
  readonly allowToolStubs?: boolean;
}
export interface HttpBasicAuthOptions {
  readonly realm?: string;
}
export interface HttpBasicCredentials {
  readonly username: string;
  readonly password: string;
}
export interface UnauthorizedChallenge {
  readonly scheme: "Basic" | "Bearer";
  readonly parameters?: Readonly<Record<string, string>>;
}
export interface UnauthorizedResponseOptions {
  readonly status?: 401 | 403;
  readonly code?: string;
  readonly message?: string;
  readonly challenges?: readonly UnauthorizedChallenge[];
}
export interface VercelOidcOptions extends Omit<VerifyVercelOidcOptions, "subjects"> {
  readonly subjects?: readonly (
    | string
    | {
        readonly subject: string;
        readonly allowToolStubs?: boolean;
      }
  )[];
}
export interface VercelSubjectInput {
  readonly teamSlug: string;
  readonly projectName: string;
  readonly environment?: VercelSubjectEnvironment;
}
export interface VerifyJwtEcdsaConfig {
  readonly algorithm: "ES256" | "ES384" | "ES512";
  readonly audiences: readonly string[];
  readonly issuer: string;
  readonly publicKey: string;
  readonly clockSkewSeconds?: number;
  readonly subjects?: readonly string[];
  readonly claims?: Readonly<Record<string, readonly string[]>>;
}
export interface VerifyJwtHmacConfig {
  readonly algorithm: "HS256" | "HS384" | "HS512";
  readonly audiences: readonly string[];
  readonly issuer: string;
  readonly secret: string;
  readonly clockSkewSeconds?: number;
  readonly subjects?: readonly string[];
  readonly claims?: Readonly<Record<string, readonly string[]>>;
}
export interface VerifyOidcConfig {
  readonly audiences: readonly string[];
  readonly issuer: string;
  readonly discoveryUrl?: string;
  readonly clockSkewSeconds?: number;
  readonly subjects?: readonly string[];
  readonly claims?: Readonly<Record<string, readonly string[]>>;
}
export interface VerifyVercelOidcOptions {
  readonly currentVercelProject?: {
    readonly environment?: string;
    readonly projectId: string;
  };
  readonly subjects?: readonly string[];
}
export type AuthErrorOptions = Omit<UnauthorizedResponseOptions, "status">;
export type AuthFn<TEvent = Request> = (
  event: TEvent,
) => AuthResult | null | undefined | Promise<AuthResult | null | undefined>;
export type IpAllowList = RuntimeIpAllowList;
export type OAuthResourceAuth = AuthFn<Request> & {
  readonly [OAUTH_RESOURCE_SYMBOL]: OAuthResourceOptions;
};
export type OAuthResourceOptions = {
  readonly metadataPath?: string;
  readonly resource?: string;
  readonly scopes?: readonly string[];
} & (
  | {
      readonly authorizationServers?: never;
      readonly issuer: string;
    }
  | {
      readonly authorizationServers: readonly string[];
      readonly issuer?: never;
    }
);
export type VercelSubjectEnvironment = "production" | "preview" | "development" | "*";
export type VerifyResult =
  | {
      readonly ok: true;
      readonly sessionAuth: SessionAuthContext;
    }
  | {
      readonly ok: false;
    };
```

### src/channel/ip-allow-list.d.ts

```ts
export interface RuntimeIpAllowList {
  readonly blockList: BlockList;
  readonly entries: readonly string[];
}
```

### src/channel/types.d.ts

```ts
export interface SessionAuthContext {
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  readonly authenticator: string;
  readonly issuer?: string;
  readonly principalId: string;
  readonly principalType: string;
  readonly subject?: string;
}
```
