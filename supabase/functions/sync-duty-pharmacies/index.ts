import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (_req) => {
  const testUrls = [
    "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://fzo.org.mk/dezurni-apteki"),
    "https://r.jina.ai/https://fzo.org.mk/dezurni-apteki"
  ];

  const results: any = {};

  for (const url of testUrls) {
    try {
      const res = await fetch(url);
      results[url] = { status: res.status, ok: res.ok };
    } catch (e: any) {
      results[url] = { error: e.message };
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
});
