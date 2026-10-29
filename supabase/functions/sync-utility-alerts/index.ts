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
  'Пехчево': { lat: 41.7619, lon: 22.9303 },
  'Дебар': { lat: 41.5250, lon: 20.5272 },
  'Центар Жупа': { lat: 41.4800, lon: 20.5597 },
  'Маврово': { lat: 41.7028, lon: 20.7350 },
  'Ростуше': { lat: 41.6100, lon: 20.6000 },
  'Кратово': { lat: 42.0786, lon: 22.1750 },
  'Неготино': { lat: 41.4839, lon: 22.0917 },
  'Дојран': { lat: 41.1789, lon: 22.7247 },
  'Брвеница': { lat: 41.9683, lon: 20.9819 },
  'Врапчиште': { lat: 41.8344, lon: 20.8856 },
  'Јегуновце': { lat: 42.0736, lon: 21.1233 },
  'Теарце': { lat: 42.0767, lon: 21.0528 },
  'Боговиње': { lat: 41.9239, lon: 20.9172 },
  'Желино': { lat: 41.9806, lon: 21.0600 },
  'Липково': { lat: 42.1558, lon: 21.5878 },
  'Старо Нагоричане': { lat: 42.1983, lon: 21.8286 },
  'Ранковце': { lat: 42.1694, lon: 22.1158 },
  'Зрновци': { lat: 41.8544, lon: 22.4439 },
  'Чешиново-Облешево': { lat: 41.8719, lon: 22.2889 },
  'Карбинци': { lat: 41.8175, lon: 22.2344 },
  'Василево': { lat: 41.4750, lon: 22.6417 },
  'Босилово': { lat: 41.4406, lon: 22.7297 },
  'Ново Село': { lat: 41.4139, lon: 22.8833 },
  'Конче': { lat: 41.4950, lon: 22.3833 },
  'Росоман': { lat: 41.5161, lon: 21.9458 },
  'Градско': { lat: 41.5775, lon: 21.9428 },
  'Чашка': { lat: 41.6550, lon: 21.6617 },
  'Долнени': { lat: 41.4261, lon: 21.4544 },
  'Кривогаштани': { lat: 41.3364, lon: 21.3333 },
  'Могила': { lat: 41.1089, lon: 21.3789 },
  'Новаци': { lat: 41.0417, lon: 21.4567 },
  'Пласница': { lat: 41.4678, lon: 21.1228 }
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

          const rawLoc = (item.nasMesto || '').trim();
          let city = '';
          let municipality = '';

          // 1. Check if rawLoc directly matches any known city / municipality
          for (const c of Object.keys(CITY_COORDS)) {
            if (rawLoc.toLowerCase() === c.toLowerCase() || rawLoc.toLowerCase().includes(c.toLowerCase())) {
              city = c;
              break;
            }
          }

          // 2. Check if rawLoc is a Skopje municipality (excluding Centar Zupa)
          if (!city) {
            for (const m of SKOPJE_MUNICIPALITIES) {
              if (rawLoc.toLowerCase().includes(m.toLowerCase()) && !rawLoc.toLowerCase().includes('центар жупа')) {
                city = 'Скопје';
                municipality = m;
                break;
              }
            }
          }

          // 3. Fallback for city: If rawLoc exists, use it (capitalized) instead of blindly defaulting to Skopje
          if (!city) {
            city = rawLoc ? (rawLoc.charAt(0).toUpperCase() + rawLoc.slice(1).toLowerCase()) : 'Скопје';
          }

          // 4. ONLY search for Skopje municipalities in item.adresa IF the city is indeed 'Скопје'!
          if (city === 'Скопје' && !municipality) {
            for (const m of SKOPJE_MUNICIPALITIES) {
              if (item.adresa && item.adresa.toLowerCase().includes(m.toLowerCase())) {
                // Avoid matching 'Центар' when the text actually refers to 'Центар Жупа'
                if (m === 'Центар' && item.adresa.toLowerCase().includes('центар жупа')) {
                  continue;
                }
                municipality = m;
                break;
              }
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

    // 3. Fetch Road Alerts from AMSM
    try {
      const res = await fetch('https://amsm.mk/sostojba-na-patishta/dnevni-informacii/', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const html = await res.text();
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let m;
        const rawItems: string[] = [];
        while ((m = liRegex.exec(html)) !== null) {
          const text = m[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&#8211;/g, '–')
            .replace(/\s+/g, ' ')
            .trim();
          if (text.length > 40 && (text.includes('пат') || text.includes('сообраќај') || text.includes('делница') || text.includes('градежни') || text.includes('режим') || text.includes('мост') || text.includes('свлечиште') || text.includes('одрон'))) {
            if (!text.includes('schema.org') && !text.includes('Патни информации') && !text.includes('патување во странство')) {
              rawItems.push(text);
            }
          }
        }

        for (const text of rawItems) {
          let matchedCity = 'Македонија';
          for (const city of Object.keys(CITY_COORDS)) {
            if (text.toLowerCase().includes(city.toLowerCase())) {
              matchedCity = city;
              break;
            }
          }

          const roadMatch = text.match(/(?:пат|делница|правец)?\s*([АРA-Za-z]\d{1,4}[а-ја-я]?)\b/iu) || text.match(/\b([АРA-Za-z]\d{1,4})\b/iu);
          let roadCode = roadMatch ? roadMatch[1].toUpperCase() : '';
          if (!roadCode && text.includes('Коридор 10')) roadCode = 'Коридор 10';

          let title = 'Измена на режим на сообраќај';
          if (text.includes('свлечиште') || text.includes('одрон')) title = 'Опасност од одрони и свлечиште';
          else if (text.includes('мост')) title = 'Санација на мост / градежни работи';
          else if (text.includes('граничен премин')) title = 'Режим на сообраќај на граничен премин';
          else if (roadCode) title = `Работи на пат (${roadCode})`;

          const coords = CITY_COORDS[matchedCity] || CITY_COORDS['Скопје'];
          const alertId = `rd_${simpleHash(text.substring(0, 80))}`;

          collectedAlerts.push({
            id: alertId,
            type: 'road',
            source: 'amsm',
            source_title: 'АМСМ · Сообраќај',
            title: title,
            city: matchedCity,
            location_name: matchedCity,
            address: text.length > 120 ? text.substring(0, 120) + '...' : text,
            start_time: now.toISOString(),
            end_time: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            voltage: roadCode || undefined,
            latitude: coords.lat,
            longitude: coords.lon,
            description: text
          });
        }
      }
    } catch (e: any) {
      console.warn("AMSM sync error:", e.message);
    }

    // 4. Fetch Earthquake Alerts from EMSC
    try {
      const url = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&lat=41.6&lon=21.7&maxradius=2.6&minmag=1.8&limit=10';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        for (const f of (data.features || [])) {
          const p = f.properties;
          const geom = f.geometry;
          const time = new Date(p.time);
          const ageHours = (now.getTime() - time.getTime()) / (1000 * 60 * 60);
          if (ageHours > 72) continue;

          const lat = geom.coordinates[1];
          const lon = geom.coordinates[0];
          const isInsideMacedonia = lat >= 40.85 && lat <= 42.36 && lon >= 20.45 && lon <= 23.03;
          const flynnUpper = (p.flynn_region || '').toUpperCase();
          if (!isInsideMacedonia && !flynnUpper.includes('MACEDONIA')) continue;

          let regionName = 'Северна Македонија';
          if (p.flynn_region && p.flynn_region.includes('REPUBLIC OF NORTH MACEDONIA')) {
            regionName = 'Северна Македонија';
          } else if (p.flynn_region) {
            regionName = p.flynn_region;
          }

          const mag = parseFloat(p.mag).toFixed(1);
          const depth = Math.round(geom.coordinates[2] || 10);
          const alertId = `eq_${simpleHash(`${p.unid || p.time}_${p.mag}`)}`;

          collectedAlerts.push({
            id: alertId,
            type: 'earthquake',
            source: 'emsc',
            source_title: 'Сеизмолошки сервис · EMSC',
            title: `Земјотрес M ${mag} (${regionName})`,
            city: 'Македонија',
            municipality: regionName,
            location_name: regionName,
            address: `Епицентар: ${regionName}`,
            start_time: time.toISOString(),
            end_time: new Date(time.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            status: ageHours <= 24 ? 'active' : 'resolved',
            voltage: `M ${mag}`,
            latitude: lat,
            longitude: lon,
            description: `Регистриран сеизмички потрес со магнитуда M ${mag} на длабочина од ${depth} km во регионот ${regionName}. Координати: ${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E.`
          });
        }
      }
    } catch (e: any) {
      console.warn("EMSC sync error:", e.message);
    }

    // 5. Upsert into utility_alerts table
    if (collectedAlerts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('utility_alerts')
        .upsert(collectedAlerts, { onConflict: 'id' });

      if (upsertErr) {
        throw new Error(`Failed to upsert alerts: ${upsertErr.message}`);
      }

      // 5b. Automatically purge obsolete utility alerts that ended more than 24 hours ago
      try {
        await supabase
          .from('utility_alerts')
          .delete()
          .lt('end_time', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      } catch (purgeErr: any) {
        console.warn("Purge obsolete alerts warning:", purgeErr.message);
      }

      // 6. Auto-trigger dispatch-utility-alerts to deliver notifications to affected users
      try {
        await fetch(`${supabaseUrl}/functions/v1/dispatch-utility-alerts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
        });
      } catch (dispatchErr: any) {
        console.warn("Auto-dispatch trigger warning:", dispatchErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced_count: collectedAlerts.length,
      types: {
        power: collectedAlerts.filter(a => a.type === 'power').length,
        water: collectedAlerts.filter(a => a.type === 'water').length,
        road: collectedAlerts.filter(a => a.type === 'road').length,
        earthquake: collectedAlerts.filter(a => a.type === 'earthquake').length
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
