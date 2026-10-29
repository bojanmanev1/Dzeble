import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NewsSource {
  name: string;
  id: string;
  url: string;
  limit: number;
}

const SOURCES: NewsSource[] = [
  {
    name: 'Слободен Печат',
    id: 'sloboden_pecat',
    url: 'https://www.slobodenpecat.mk/feed/',
    limit: 6
  },
  {
    name: 'Нова Македонија',
    id: 'nova_makedonija',
    url: 'https://novamakedonija.com.mk/feed/',
    limit: 6
  },
  {
    name: 'Фактор',
    id: 'faktor',
    url: 'https://faktor.mk/feed/',
    limit: 6
  },
  {
    name: 'Фокус',
    id: 'fokus',
    url: 'https://fokus.mk/feed/',
    limit: 5
  },
  {
    name: 'МКД.мк',
    id: 'mkd',
    url: 'https://mkd.mk/feed/',
    limit: 5
  }
];

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXml(xml: string, source: NewsSource): any[] {
  const items: any[] = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches.slice(0, source.limit)) {
    const rawTitleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);

    if (!rawTitleMatch || !linkMatch) continue;

    const rawTitle = rawTitleMatch[1];
    const link = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
    const cleanTitle = decodeHtmlEntities(rawTitle);

    if (!cleanTitle || cleanTitle.length < 5 || !link.startsWith('http')) continue;

    let publishedAt = new Date().toISOString();
    if (pubDateMatch && pubDateMatch[1]) {
      const parsedDate = new Date(pubDateMatch[1].trim());
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    let summary = '';
    if (descMatch && descMatch[1]) {
      summary = decodeHtmlEntities(descMatch[1]).substring(0, 200);
    }

    const id = `${source.id}_${simpleHash(link)}`;

    items.push({
      id,
      title: cleanTitle,
      link_url: link,
      source_name: source.name,
      source_id: source.id,
      summary: summary || null,
      published_at: publishedAt
    });
  }

  return items;
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase service environment keys" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const allCollectedNews: any[] = [];
    const diagnostics: any[] = [];

    // 1. Fetch RSS from all defined reputable sources
    for (const source of SOURCES) {
      try {
        const res = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'mk,en-US;q=0.9,en;q=0.8',
            'Referer': 'https://www.google.com/'
          }
        });

        if (res.ok) {
          const xml = await res.text();
          const items = parseRssXml(xml, source);
          allCollectedNews.push(...items);
          diagnostics.push({ source: source.name, status: res.status, count: items.length });
        } else {
          diagnostics.push({ source: source.name, status: res.status, count: 0 });
        }
      } catch (err: any) {
        diagnostics.push({ source: source.name, error: err.message, count: 0 });
      }
    }

    // 2. Upsert into latest_news table
    if (allCollectedNews.length > 0) {
      const { error: upsertErr } = await supabase
        .from('latest_news')
        .upsert(allCollectedNews, { onConflict: 'id' });

      if (upsertErr) {
        throw new Error(`Failed to upsert news: ${upsertErr.message}`);
      }

      // 3. Strictly prune database to keep ONLY the latest 20 news items (zero bloat, ~6 KB total)
      try {
        await supabase.rpc('prune_latest_news', { p_keep_limit: 20 });
      } catch (pruneErr: any) {
        console.warn('Prune news warning:', pruneErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced_count: allCollectedNews.length,
      diagnostics
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to sync RSS news" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
