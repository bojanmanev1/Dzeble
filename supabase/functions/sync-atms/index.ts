import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OVERPASS_QUERY = `[out:json][timeout:25];
(
  node["amenity"="atm"](40.85,20.45,42.36,23.03);
  node["amenity"="bank"]["atm"="yes"](40.85,20.45,42.36,23.03);
  node["amenity"="bank"](40.85,20.45,42.36,23.03);
  way["amenity"="atm"](40.85,20.45,42.36,23.03);
);
out center;`;

function cleanBank(name: string, rawTags?: string) {
  const s = `${name} ${rawTags || ''}`.toLowerCase();

  if (s.includes('комерцијална') || s.includes('komercijalna') || s.includes('komercjalna') || s.includes('комеецијална') || s.includes('komercbank')) {
    return { name: 'Комерцијална Банка', slug: 'komercijalna' };
  }
  if (s.includes('стопанска банка битола') || s.includes('stopanska banka bitola')) {
    return { name: 'Стопанска Банка Битола', slug: 'stopanska-bt' };
  }
  if (s.includes('стопанска') || s.includes('stopanska') || s.includes('stolanska') || s.includes('stb')) {
    return { name: 'Стопанска Банка Скопје', slug: 'stopanska' };
  }
  if (s.includes('нлб') || s.includes('nlb') || s.includes('тутунска') || s.includes('tutunska')) {
    return { name: 'НЛБ Банка', slug: 'nlb' };
  }
  if (s.includes('халк') || s.includes('halk') || s.includes('hallbank')) {
    return { name: 'Халкбанк', slug: 'halk' };
  }
  if (s.includes('шпаркасе') || s.includes('sparkasse') || s.includes('охридска') || s.includes('ohridsk') || s.includes('seciete')) {
    return { name: 'Шпаркасе Банка', slug: 'sparkasse' };
  }
  if (s.includes('уни') || s.includes('uni bank') || s.includes('unibanka') || s.includes('uni ') || s === 'uni') {
    return { name: 'УНИБанка', slug: 'unibanka' };
  }
  if (s.includes('прокредит') || s.includes('procredit')) {
    return { name: 'ПроКредит Банка', slug: 'procredit' };
  }
  if (s.includes('ттк') || s.includes('ttk')) {
    return { name: 'ТТК Банка', slug: 'ttk' };
  }
  if (s.includes('цкб') || s.includes('ckb') || s.includes('ccb') || s.includes('централна кооп') || s.includes('central coo') || s.includes('centralna kooper')) {
    return { name: 'ЦКБ Банка', slug: 'ckb' };
  }
  if (s.includes('силк') || s.includes('silk')) {
    return { name: 'Силк Роуд Банка', slug: 'silkroad' };
  }
  if (s.includes('народна банка')) {
    return { name: 'НБРМ', slug: 'nbrm' };
  }

  return { name: 'Банкомат', slug: 'other' };
}

function cleanCity(city: string, lat: number, lon: number): string {
  const c = (city || '').trim();
  if (c.toLowerCase().includes('skopje') || c.toLowerCase().includes('скопје') || c.includes('Cкoпje')) return 'Скопје';
  if (c.toLowerCase().includes('bitola') || c.toLowerCase().includes('битола')) return 'Битола';
  if (c.toLowerCase().includes('kumanovo') || c.toLowerCase().includes('куманово')) return 'Куманово';
  if (c.toLowerCase().includes('prilep') || c.toLowerCase().includes('прилеп')) return 'Прилеп';
  if (c.toLowerCase().includes('tetovo') || c.toLowerCase().includes('тетово')) return 'Тетово';
  if (c.toLowerCase().includes('ohrid') || c.toLowerCase().includes('охрид')) return 'Охрид';
  if (c.toLowerCase().includes('veles') || c.toLowerCase().includes('велес')) return 'Велес';
  if (c.toLowerCase().includes('stip') || c.toLowerCase().includes('штип')) return 'Штип';
  if (c.toLowerCase().includes('strumica') || c.toLowerCase().includes('струмица')) return 'Струмица';
  if (c.toLowerCase().includes('gostivar') || c.toLowerCase().includes('гостивар')) return 'Гостивар';
  if (c.toLowerCase().includes('struga') || c.toLowerCase().includes('струга')) return 'Струга';
  if (c.toLowerCase().includes('kavadarci') || c.toLowerCase().includes('кавадарци')) return 'Кавадарци';
  if (c.toLowerCase().includes('kocani') || c.toLowerCase().includes('кочани')) return 'Кочани';
  if (c.toLowerCase().includes('kicevo') || c.toLowerCase().includes('кичево')) return 'Кичево';
  if (c.toLowerCase().includes('gevgelija') || c.toLowerCase().includes('гевгелија')) return 'Гевгелија';

  if (lat >= 41.90 && lat <= 42.08 && lon >= 21.30 && lon <= 21.60) return 'Скопје';
  if (lat >= 40.98 && lat <= 41.07 && lon >= 21.28 && lon <= 21.38) return 'Битола';
  if (lat >= 42.10 && lat <= 42.17 && lon >= 21.68 && lon <= 21.76) return 'Куманово';
  if (lat >= 41.30 && lat <= 41.38 && lon >= 21.50 && lon <= 21.60) return 'Прилеп';
  if (lat >= 41.98 && lat <= 42.03 && lon >= 20.94 && lon <= 21.00) return 'Тетово';
  if (lat >= 41.10 && lat <= 41.15 && lon >= 20.78 && lon <= 20.84) return 'Охрид';
  if (lat >= 41.68 && lat <= 41.75 && lon >= 21.75 && lon <= 21.82) return 'Велес';
  if (lat >= 41.71 && lat <= 41.77 && lon >= 22.16 && lon <= 22.23) return 'Штип';
  if (lat >= 41.41 && lat <= 41.47 && lon >= 22.61 && lon <= 22.68) return 'Струмица';
  if (lat >= 41.78 && lat <= 41.83 && lon >= 20.88 && lon <= 20.94) return 'Гостивар';
  if (lat >= 41.16 && lat <= 41.20 && lon >= 20.65 && lon <= 20.71) return 'Струга';
  if (lat >= 41.41 && lat <= 41.46 && lon >= 22.00 && lon <= 22.04) return 'Кавадарци';
  if (lat >= 41.90 && lat <= 41.94 && lon >= 22.39 && lon <= 22.44) return 'Кочани';
  if (lat >= 41.50 && lat <= 41.53 && lon >= 20.94 && lon <= 20.98) return 'Кичево';
  if (lat >= 41.13 && lat <= 41.16 && lon >= 22.49 && lon <= 22.53) return 'Гевгелија';

  return c || 'Скопје';
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const mirrors = [
      "https://overpass.private.coffee/api/interpreter",
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter",
    ];

    let rawElements: any[] = [];
    for (const mirror of mirrors) {
      try {
        const res = await fetch(mirror, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "DzebleApp/1.0 (contact@dzeble.mk)",
          },
          body: "data=" + encodeURIComponent(OVERPASS_QUERY),
        });
        if (!res.ok) continue;
        const json = await res.json();
        if (json?.elements?.length) {
          rawElements = json.elements;
          break;
        }
      } catch (_) {
        // try next mirror
      }
    }

    if (!rawElements.length) {
      return new Response(JSON.stringify({ error: "Failed to fetch from Overpass mirrors" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const seen = new Set<string>();
    const atms: any[] = [];

    for (const el of rawElements) {
      const lat = el.lat || el.center?.lat;
      const lon = el.lon || el.center?.lon;
      if (!lat || !lon) continue;

      const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const tags = el.tags || {};
      const bank = cleanBank(tags.operator || tags.brand || tags.name || "", tags.name);
      const city = cleanCity(tags["addr:city"] || "", lat, lon);

      let street = tags["addr:street"] || "";
      let houseNumber = tags["addr:housenumber"] || "";
      let fullAddr = street ? `${street} ${houseNumber}`.trim() : (tags.description || tags.note || `Локација ${city}`);
      let locationDesc = tags.description || tags["addr:suburb"] || tags["addr:place"] || tags["name"] || null;

      const is24_7 = tags.opening_hours === "24/7" || !tags.opening_hours || tags.opening_hours.includes("24/7");
      const hasDeposit = tags.cash_in === "yes" || tags["atm:cash_in"] === "yes";

      atms.push({
        id: `atm_${el.type}_${el.id}`,
        name: `Банкомат ${bank.name}`,
        bank: bank.name,
        bank_slug: bank.slug,
        city: city,
        city_slug: city.toLowerCase().replace(/\s+/g, "-"),
        address: fullAddr,
        location_description: locationDesc,
        latitude: lat,
        longitude: lon,
        is_24_7: is24_7,
        working_hours: tags.opening_hours || (is24_7 ? "24/7" : "Понеделник - Сабота 08:00 - 20:00"),
        has_deposit: hasDeposit,
        currency: "MKD",
        updated_at: new Date().toISOString(),
      });
    }

    // Upsert in batches of 100
    let totalUpserted = 0;
    for (let i = 0; i < atms.length; i += 100) {
      const batch = atms.slice(i, i + 100);
      const { error } = await supabase.from("bank_atms").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error("Batch upsert error:", error);
      } else {
        totalUpserted += batch.length;
      }
    }

    return new Response(JSON.stringify({ success: true, count: totalUpserted }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
