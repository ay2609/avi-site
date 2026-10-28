/**
 * The Worker in front of the static site (wrangler.jsonc: `main`, with the
 * assets bound as ASSETS and run first through here). aviyadava.com is the
 * site's address (Oct 28); the old address and the www names send every
 * request there for good, path and query kept. Everything else — the
 * canonical host, workers.dev, a local `wrangler dev` — is served as-is.
 */

const CANONICAL = "aviyadava.com";
const MOVED = new Set(["halcyn.dev", "www.halcyn.dev", "www.aviyadava.com"]);

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (MOVED.has(url.hostname)) {
      url.protocol = "https:";
      url.hostname = CANONICAL;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
