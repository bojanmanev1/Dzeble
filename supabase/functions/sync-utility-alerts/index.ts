import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SKOPJE_MUNICIPALITIES = [
  'Аеродром', 'Гази Баба', 'Ѓорче Петров', 'Карпош', 'Центар', 'Кисела Вода',
  'Бутел', 'Чаир', 'Шуто Оризари', 'Сарај', 'Илинден', 'Петровец',
  'Сопиште', 'Студеничани', 'Зелениково', 'Арачиново', 'Чучер Сандево'
];

const SKOPJE_NEIGHBORHOOD_TO_MUNI: Record<string, string> = {
  'јане сандански': 'Аеродром',
  'ново лисиче': 'Аеродром',
  'лисиче': 'Аеродром',
  'мичурин': 'Аеродром',
  'острово': 'Аеродром',
  'бисер': 'Аеродром',
  'карпош': 'Карпош',
  'тафталиџе': 'Карпош',
  'влае': 'Карпош',
  'козле': 'Карпош',
  'злокуќани': 'Карпош',
  'бардовци': 'Карпош',
  'центар': 'Центар',
  'дебар маало': 'Центар',
  'капиштец': 'Центар',
  'водно': 'Центар',
  'крњево': 'Центар',
  'мтв': 'Центар',
  'маџир маало': 'Центар',
  'буњаковец': 'Центар',
  'мирослав крлежа': 'Центар',
  'дана ступки': 'Центар',
  'дана ступци': 'Центар',
  'кисела вода': 'Кисела Вода',
  'драчево': 'Кисела Вода',
  'пржино': 'Кисела Вода',
  'црниче': 'Кисела Вода',
  'пинтија': 'Кисела Вода',
  'усје': 'Кисела Вода',
  'ѓорче петров': 'Ѓорче Петров',
  'ѓорче': 'Ѓорче Петров',
  'хром': 'Ѓорче Петров',
  'даме груев': 'Ѓорче Петров',
  'волково': 'Ѓорче Петров',
  'ново село': 'Ѓорче Петров',
  'гази баба': 'Гази Баба',
  'автокоманда': 'Гази Баба',
  'маџари': 'Гази Баба',
  'ченто': 'Гази Баба',
  'железара': 'Гази Баба',
  'ќерамидница': 'Гази Баба',
  'бутел': 'Бутел',
  'радишани': 'Бутел',
  'иван манолев': 'Бутел',
  'чаир': 'Чаир',
  'топанско': 'Чаир',
  'серава': 'Чаир',
  'македонска косовска бригада': 'Чаир',
  'македонска косовоска бригада': 'Чаир',
  'шуто оризари': 'Шуто Оризари',
  'шутка': 'Шуто Оризари',
  'сарај': 'Сарај',
  'моране': 'Студеничани',
  'студеничани': 'Студеничани'
};

const MUNICIPALITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Центар': { lat: 41.9950, lon: 21.4310 },
  'Карпош': { lat: 42.0020, lon: 21.3920 },
  'Аеродром': { lat: 41.9860, lon: 21.4670 },
  'Кисела Вода': { lat: 41.9750, lon: 21.4380 },
  'Гази Баба': { lat: 42.0120, lon: 21.4720 },
  'Ѓорче Петров': { lat: 42.0080, lon: 21.3530 },
  'Чаир': { lat: 42.0130, lon: 21.4370 },
  'Бутел': { lat: 42.0340, lon: 21.4460 },
  'Шуто Оризари': { lat: 42.0430, lon: 21.4280 },
  'Сарај': { lat: 42.0000, lon: 21.3250 },
  'Илинден': { lat: 41.9950, lon: 21.5790 },
  'Петровец': { lat: 41.9390, lon: 21.6140 },
  'Сопиште': { lat: 41.9540, lon: 21.4220 },
  'Студеничани': { lat: 41.9170, lon: 21.5300 },
  'Зелениково': { lat: 41.8850, lon: 21.5890 },
  'Арачиново': { lat: 42.0260, lon: 21.5620 },
  'Чучер Сандево': { lat: 42.0880, lon: 21.4190 }
};

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Скопје': { lat: 41.9981, lon: 21.4254 },
  'Битола': { lat: 41.0319, lon: 21.3347 },
  'Прилеп': { lat: 41.3444, lon: 21.5542 },
  'Куманово': { lat: 42.1322, lon: 21.7144 },
  'Тетово': { lat: 42.0105, lon: 20.9715 },
  'Велес': { lat: 41.7165, lon: 21.7725 },
  'Штип': { lat: 41.7417, lon: 22.1953 },
  'Охрид': { lat: 41.1172, lon: 20.8016 },
  'Струмица': { lat: 41.4375, lon: 22.6433 },
  'Кавадарци': { lat: 41.4331, lon: 22.0119 },
  'Кочани': { lat: 41.9167, lon: 22.4125 },
  'Гостивар': { lat: 41.7960, lon: 20.9082 },
  'Гевгелија': { lat: 41.1432, lon: 22.5028 },
  'Кичево': { lat: 41.5139, lon: 20.9631 },
  'Струга': { lat: 41.1775, lon: 20.6789 },
  'Радовиш': { lat: 41.6381, lon: 22.4647 },
  'Ресен': { lat: 41.0889, lon: 21.0125 },
  'Крива Паланка': { lat: 42.2014, lon: 22.3314 },
  'Берово': { lat: 41.7061, lon: 22.8578 },
  'Делчево': { lat: 41.9681, lon: 22.7711 },
  'Пробиштип': { lat: 42.0039, lon: 22.1814 },
  'Свети Николе': { lat: 41.8650, lon: 21.9428 },
  'Виница': { lat: 41.8828, lon: 22.5092 },
  'Демир Хисар': { lat: 41.2206, lon: 21.2031 },
  'Крушево': { lat: 41.3697, lon: 21.2492 },
  'Македонски Брод': { lat: 41.5133, lon: 21.2164 },
  'Македонска Каменица': { lat: 42.0208, lon: 22.5878 },
  'Богданци': { lat: 41.2031, lon: 22.5764 },
  'Валандово': { lat: 41.3169, lon: 22.5611 },
  'Демир Капија': { lat: 41.4114, lon: 22.2417 },
  'Пехчево': { lat: 41.7619, lon: 22.9303 }
};

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
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
    const now = new Date();
    const collectedAlerts: any[] = [];

    // 1. Fetch Power Alerts from EVN API
    try {
      const res = await fetch('https://portal-api.elektrodistribucija.mk/DSO/Prekini/ZemiPrekini');
      if (res.ok) {
        const data = await res.json();
        for (const item of (data || [])) {
          const startDate = new Date(item.pocetok);
          const endDate = new Date(item.kraj);
          if (now.getTime() - endDate.getTime() > 12 * 60 * 60 * 1000) continue;

          let status = 'upcoming';
          if (now >= startDate && now <= endDate) status = 'active';
          else if (now > endDate) status = 'resolved';

          const locName = item.nasMesto || 'Скопје';
          let city = 'Скопје';
          let municipality = '';
          for (const c of Object.keys(CITY_COORDS)) {
            if (locName.toLowerCase().includes(c.toLowerCase())) {
              city = c;
              break;
            }
          }
          for (const m of SKOPJE_MUNICIPALITIES) {
            if (locName.toLowerCase().includes(m.toLowerCase()) || (item.adresa && item.adresa.toLowerCase().includes(m.toLowerCase()))) {
              municipality = m;
              break;
            }
          }

          const coords = municipality && MUNICIPALITY_COORDS[municipality] 
            ? MUNICIPALITY_COORDS[municipality] 
            : (CITY_COORDS[city] || CITY_COORDS['Скопје']);

          collectedAlerts.push({
            id: String(item.prekinID || `pwr_${simpleHash(item.nasMesto + item.adresa + item.pocetok)}`),
            type: 'power',
            source: 'elektrodistribucija',
            source_title: 'Електродистрибуција · ЕВН',
            title: item.tipPrekin || 'Планиран прекин на електрична енергија',
            city: city,
            municipality: municipality || null,
            location_name: item.nasMesto,
            address: item.adresa,
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            status: status,
            voltage: item.napNivo,
            latitude: coords.lat,
            longitude: coords.lon,
            description: `Прекин во снабдување со електрична енергија (${item.napNivo || 'НН'}). Засегнати локации: ${item.adresa}.`
          });
        }
      }
    } catch (e: any) {
      console.warn("EVN sync error:", e.message);
    }

    // 2. Fetch Water Alerts from Vodovod Skopje
    try {
      const res = await fetch('https://www.vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1');
      if (res.ok) {
        const html = await res.text();
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let match;
        while ((match = pRegex.exec(html)) !== null) {
          const cleanText = match[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&ndash;|&mdash;/g, '-')
            .replace(/\s+/g, ' ')
            .trim();

          if ((cleanText.includes('известуваме') || cleanText.includes('најавуваме')) && (cleanText.includes('прекин') || cleanText.includes('дефект'))) {
            const normalized = cleanText.replace(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/g, '$1.$2.$3');
            const dateMatch = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (!dateMatch) continue;

            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const year = parseInt(dateMatch[3], 10);

            const timeMatch = normalized.match(/од\s*(\d{1,2}[:.]\d{2})/i);
            let hours = 8, minutes = 30;
            if (timeMatch) {
              const parts = timeMatch[1].replace('.', ':').split(':');
              hours = parseInt(parts[0], 10);
              minutes = parseInt(parts[1], 10);
            }

            const alertDate = new Date(year, month, day, hours, minutes);
            if (now.getTime() - alertDate.getTime() > 7 * 24 * 60 * 60 * 1000) continue;

            let endIso;
            const endTimeMatch = normalized.match(/до\s*(\d{1,2}[:.]\d{2})/i);
            if (endTimeMatch) {
              const endParts = endTimeMatch[1].replace('.', ':').split(':');
              endIso = new Date(year, month, day, parseInt(endParts[0], 10), parseInt(endParts[1], 10)).toISOString();
            } else {
              endIso = new Date(alertDate.getTime() + 5 * 60 * 60 * 1000).toISOString();
            }

            let municipality = '';
            for (const mun of SKOPJE_MUNICIPALITIES) {
              if (cleanText.toLowerCase().includes(mun.toLowerCase())) {
                municipality = mun;
                break;
              }
            }
            if (!municipality) {
              const lower = cleanText.toLowerCase();
              for (const [key, muni] of Object.entries(SKOPJE_NEIGHBORHOOD_TO_MUNI)) {
                if (lower.includes(key)) {
                  municipality = muni;
                  break;
                }
              }
            }

            const coords = municipality && MUNICIPALITY_COORDS[municipality]
              ? MUNICIPALITY_COORDS[municipality]
              : CITY_COORDS['Скопје'];

            let streetAddress = cleanText;
            const streetMatch = cleanText.match(/(?:ул\.|улица|бул\.|булевар)\s*[^,.]+/i);
            if (streetMatch) streetAddress = streetMatch[0].trim();

            const isResolved = cleanText.toLowerCase().includes('е завршен') || cleanText.toLowerCase().includes('нормализирано');
            let status = 'upcoming';
            if (isResolved || now > new Date(endIso)) status = 'resolved';
            else if (now >= alertDate && now <= new Date(endIso)) status = 'active';

            collectedAlerts.push({
              id: `wtr_${simpleHash(cleanText.substring(0, 80))}`,
              type: 'water',
              source: 'vodovod',
              source_title: 'ЈП Водовод и Канализација',
              title: 'Прекин во водоснабдување',
              city: 'Скопје',
              municipality: municipality || null,
              location_name: municipality ? `Скопје (${municipality})` : 'Скопје',
              address: streetAddress,
              start_time: alertDate.toISOString(),
              end_time: endIso,
              status: status,
              latitude: coords.lat,
              longitude: coords.lon,
              description: cleanText
            });
          }
        }
      }
    } catch (e: any) {
      console.warn("Vodovod sync error:", e.message);
    }

    // 3. Upsert into utility_alerts table
    if (collectedAlerts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('utility_alerts')
        .upsert(collectedAlerts, { onConflict: 'id' });

      if (upsertErr) {
        throw new Error(`Failed to upsert alerts: ${upsertErr.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced_count: collectedAlerts.length,
      types: {
        power: collectedAlerts.filter(a => a.type === 'power').length,
        water: collectedAlerts.filter(a => a.type === 'water').length
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to sync utility alerts" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
