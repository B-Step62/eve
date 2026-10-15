---
"eve": patch
---

Add `EVE_EVAL_TRUSTED_OIDC_TOKEN`, so `eve eval --url` can reach a protected Vercel deployment with an OIDC token you already have, such as a GitHub Actions ID token, through the deployment's Trusted Sources.
