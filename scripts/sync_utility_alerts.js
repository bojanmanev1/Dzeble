const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKOPJE_MUNICIPALITIES = [
  'Аеродром', 'Гази Баба', 'Ѓорче Петров', 'Карпош', 'Центар', 'Кисела Вода',
  'Бутел', 'Чаир', 'Шуто Оризари', 'Сарај', 'Илинден', 'Петровец',
  'Сопиште', 'Студеничани', 'Зелениково', 'Арачиново', 'Чучер Сандево'
];

const SKOPJE_NEIGHBORHOOD_TO_MUNI = {
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

const MK_CITIES = [
  'Скопје', 'Битола', 'Прилеп', 'Куманово', 'Тетово', 'Велес', 'Штип', 'Охрид',
  'Струмица', 'Кавадарци', 'Кочани', 'Гостивар', 'Гевгелија', 'Кичево', 'Струга',
  'Радовиш', 'Ресен', 'Крива Паланка', 'Берово', 'Делчево', 'Пробиштип', 'Свети Николе',
  'Виница', 'Демир Хисар', 'Крушево', 'Македонски Брод', 'Македонска Каменица',
  'Богданци', 'Валандово', 'Демир Капија', 'Пехчево', 'Дојран', 'Кратово', 'Маврово', 'Дебар'
];

const MUNICIPALITY_COORDS = {
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

const CITY_COORDS = {
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
  'Дојран': { lat: 41.1789, lon: 22.7247 },
  'Кратово': { lat: 42.0786, lon: 22.1750 },
  'Маврово': { lat: 41.7028, lon: 20.7350 },
  'Дебар': { lat: 41.5250, lon: 20.5272 },
  'Македонија': { lat: 41.6086, lon: 21.7453 }
};

function resolveLocation(nasMesto) {
  const norm = (nasMesto || '').toUpperCase();

  // Check if Skopje municipality
  for (const mun of SKOPJE_MUNICIPALITIES) {
    if (norm.includes(mun.toUpperCase())) {
      return { city: 'Скопје', municipality: mun };
    }
  }

  // Check other cities
  for (const city of MK_CITIES) {
    if (norm.includes(city.toUpperCase())) {
      return { city: city, municipality: '' };
    }
  }

  return { city: nasMesto ? nasMesto.split('-')[0].trim() : 'Скопје', municipality: '' };
}

function generateId(prefix, text) {
  const hash = crypto.createHash('md5').update(text).digest('hex').substring(0, 10);
  return `${prefix}_${hash}`;
}

function extractStreet(text) {
  if (!text) return null;
  const m = text.match(/(?:УЛИЦИТЕ|УЛИЦА|УЛ\.?|БУЛЕВАР|БУЛ\.?|СЕЛОТО|СЕЛО|С\.)\s*([\p{L}\p{N}\s-]+?)(?:,|\.|\s+СО|\s+И|\s+БР|$)/iu);
  if (m) {
    let s = m[1].trim();
    s = s.replace(/^ДЕЛ\s+ОД\s+/i, '').replace(/^НА\s+ДЕЛ\s+ОД\s+/i, '').trim();
    s = s.replace(/\s+ЌЕ\s+.*$/i, '').trim();
    if (s.length > 2 && s.length < 50) return s;
  }
  return null;
}

// Geocode cache persistence to avoid redundant Nominatim calls
const cachePath = path.join(__dirname, 'geocode_cache.json');
let geocodeCache = {};
if (fs.existsSync(cachePath)) {
  try {
    geocodeCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (e) {
    geocodeCache = {};
  }
}

async function geocodeAlert(alert) {
  if (alert.latitude && alert.longitude) {
    return { latitude: alert.latitude, longitude: alert.longitude };
  }

  const street = extractStreet(alert.address) || extractStreet(alert.title);
  const city = alert.city || 'Скопје';
  const municipality = alert.municipality || '';

  // Centroid fallback
  let fallback = null;
  if (municipality && MUNICIPALITY_COORDS[municipality]) {
    fallback = MUNICIPALITY_COORDS[municipality];
  } else if (city && CITY_COORDS[city]) {
    fallback = CITY_COORDS[city];
  } else {
    fallback = CITY_COORDS['Скопје'];
  }

  if (!street) {
    return { latitude: fallback.lat, longitude: fallback.lon };
  }

  const cacheKey = `${street.toLowerCase()}_${(municipality || city).toLowerCase()}`;
  if (geocodeCache[cacheKey]) {
    return {
      latitude: geocodeCache[cacheKey].lat,
      longitude: geocodeCache[cacheKey].lon
    };
  }

  // Attempt Nominatim query with polite timeout
  try {
    const query = `${street}, ${municipality ? municipality + ', ' : ''}${city}, North Macedonia`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=mk&limit=1&q=${encodeURIComponent(query)}`;
    
    // 500ms pause to respect OpenStreetMap rate limits
    await new Promise(r => setTimeout(r, 500));

    const res = await fetch(url, {
      headers: { 'User-Agent': 'DzebleApp/1.0 (contact@dzeble.mk)' }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0 && data[0].lat && data[0].lon) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        geocodeCache[cacheKey] = { lat, lon };
        return { latitude: lat, longitude: lon };
      }
    }
  } catch (err) {
    // Fall back quietly on network error
  }

  // Fallback to municipality / city centroid and cache
  geocodeCache[cacheKey] = fallback;
  return { latitude: fallback.lat, longitude: fallback.lon };
}

async function fetchPowerAlerts() {
  console.log('⚡ Fetching power outages from Elektrodistribucija...');
  const res = await fetch('https://portal-api.elektrodistribucija.mk/DSO/Prekini/ZemiPrekini');
  if (!res.ok) throw new Error(`EVN API error: ${res.status}`);
  const data = await res.json();

  const now = new Date();
  const alerts = [];

  for (const item of data) {
    const loc = resolveLocation(item.nasMesto);
    const startDate = new Date(item.pocetok);
    const endDate = new Date(item.kraj);

    let status = 'upcoming';
    if (now >= startDate && now <= endDate) {
      status = 'active';
    } else if (now > endDate) {
      status = 'resolved';
    }

    // Skip alerts resolved more than 12 hours ago
    if (now.getTime() - endDate.getTime() > 12 * 60 * 60 * 1000) {
      continue;
    }

    const alertId = item.prekinID || generateId('pwr', `${item.nasMesto}_${item.adresa}_${item.pocetok}`);

    alerts.push({
      id: alertId,
      type: 'power',
      source: 'elektrodistribucija',
      source_title: 'Електродистрибуција · ЕВН',
      title: item.tipPrekin || 'Планиран прекин на електрична енергија',
      city: loc.city,
      municipality: loc.municipality,
      location_name: item.nasMesto,
      address: item.adresa,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: status,
      voltage: item.napNivo,
      description: `Прекин во снабдување со електрична енергија (${item.napNivo || 'НН'}). Засегнати локации: ${item.adresa}.`
    });
  }

  console.log(`✅ Processed ${alerts.length} power alerts from EVN.`);
  return alerts;
}

async function fetchWaterAlerts() {
  console.log('💧 Fetching water outages from Vodovod Skopje...');
  const alerts = [];
  try {
    const url = 'https://www.vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Vodovod error: ${res.status}`);
    const html = await res.text();

    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    const now = new Date();

    while ((match = pRegex.exec(html)) !== null) {
      const cleanText = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&ndash;|&mdash;/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

      if ((cleanText.includes('известуваме') || cleanText.includes('најавуваме')) && (cleanText.includes('прекин') || cleanText.includes('дефект'))) {
        // Normalize date formatting (e.g. "15 . 10 . 2026" or "18.09.2026")
        const normalized = cleanText.replace(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/g, '$1.$2.$3');
        const dateMatch = normalized.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);

        // If no explicit date is found, skip to avoid false alarms from untracked text
        if (!dateMatch) {
          continue;
        }

        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1;
        const year = parseInt(dateMatch[3], 10);

        // Extract time: од HH:MM
        const timeMatch = normalized.match(/од\s*(\d{1,2}[:.]\d{2})/i);
        let hours = 8, minutes = 30;
        if (timeMatch) {
          const parts = timeMatch[1].replace('.', ':').split(':');
          hours = parseInt(parts[0], 10);
          minutes = parseInt(parts[1], 10);
        }

        const alertDate = new Date(year, month, day, hours, minutes);
        const startIso = alertDate.toISOString();

        // Water outages in Skopje: keep announcements from the last 7 days
        // so users can see current active defects as well as recently resolved repairs.
        const ageMs = now.getTime() - alertDate.getTime();
        if (ageMs > 7 * 24 * 60 * 60 * 1000) {
          continue;
        }

        // End time: до HH:MM or +5 hours
        let endIso;
        const endTimeMatch = normalized.match(/до\s*(\d{1,2}[:.]\d{2})/i);
        if (endTimeMatch) {
          const endParts = endTimeMatch[1].replace('.', ':').split(':');
          const endH = parseInt(endParts[0], 10);
          const endM = parseInt(endParts[1], 10);
          endIso = new Date(year, month, day, endH, endM).toISOString();
        } else {
          // Default repair window: 5 hours after start
          endIso = new Date(alertDate.getTime() + 5 * 60 * 60 * 1000).toISOString();
        }

        // Municipality detection
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

        const alertId = generateId('wtr', cleanText.substring(0, 80));
        const startDate = new Date(startIso);
        const endDate = new Date(endIso);

        const isExplicitlyResolved = cleanText.toLowerCase().includes('е завршен') || 
                                     cleanText.toLowerCase().includes('нормализирано');

        let status = 'upcoming';
        if (isExplicitlyResolved || now > endDate) {
          status = 'resolved';
        } else if (now >= startDate && now <= endDate) {
          status = 'active';
        }

        // Extract street name cleanly
        let streetAddress = cleanText;
        const streetMatch = cleanText.match(/(?:ул\.|улица|бул\.|булевар)\s*[^,.]+/i);
        if (streetMatch) {
          streetAddress = streetMatch[0].trim();
        } else if (cleanText.length > 100) {
          streetAddress = cleanText.substring(0, 100) + '...';
        }

        alerts.push({
          id: alertId,
          type: 'water',
          source: 'vodovod',
          source_title: 'ЈП Водовод и Канализација',
          title: 'Прекин во водоснабдување',
          city: 'Скопје',
          municipality: municipality,
          location_name: municipality ? `Скопје (${municipality})` : 'Скопје',
          address: streetAddress,
          start_time: startIso,
          end_time: endIso,
          status: status,
          description: cleanText
        });
      }
    }
    console.log(`✅ Processed ${alerts.length} water alerts from Vodovod Skopje.`);
  } catch (err) {
    console.warn('Vodovod fetch error:', err.message);
  }
  return alerts;
}

async function fetchEarthquakeAlerts() {
  console.log('🌐 Fetching real-time earthquakes from EMSC...');
  const alerts = [];
  try {
    const url = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&lat=41.6&lon=21.7&maxradius=2.6&minmag=1.8&limit=10';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EMSC error: ${res.status}`);
    const data = await res.json();
    const now = new Date();

    for (const f of (data.features || [])) {
      const p = f.properties;
      const geom = f.geometry;
      const time = new Date(p.time);
      const ageHours = (now.getTime() - time.getTime()) / (1000 * 60 * 60);

      // Only display earthquakes from the last 72 hours
      if (ageHours > 72) continue;

      const lat = geom.coordinates[1];
      const lon = geom.coordinates[0];

      // Strictly filter to territory of North Macedonia (lat 40.85 to 42.36, lon 20.45 to 23.03)
      const isInsideMacedonia = lat >= 40.85 && lat <= 42.36 && lon >= 20.45 && lon <= 23.03;
      const flynnUpper = (p.flynn_region || '').toUpperCase();
      if (!isInsideMacedonia && !flynnUpper.includes('MACEDONIA')) {
        continue; // Skip any earthquake outside Macedonia
      }

      let regionName = 'Северна Македонија';
      if (p.flynn_region && p.flynn_region.includes('REPUBLIC OF NORTH MACEDONIA')) {
        regionName = 'Северна Македонија';
      } else if (p.flynn_region) {
        regionName = p.flynn_region;
      }
      let city = 'Македонија';

      const mag = parseFloat(p.mag).toFixed(1);
      const depth = Math.round(geom.coordinates[2] || 10);
      const alertId = generateId('eq', `${p.unid || p.time}_${p.mag}`);

      alerts.push({
        id: alertId,
        type: 'earthquake',
        source: 'emsc',
        source_title: 'Сеизмолошки сервис · EMSC',
        title: `Земјотрес M ${mag} (${regionName})`,
        city: city,
        municipality: regionName,
        location_name: regionName,
        address: `Епицентар: ${regionName}`,
        start_time: time.toISOString(),
        end_time: new Date(time.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        status: ageHours <= 24 ? 'active' : 'resolved',
        voltage: `M ${mag}`,
        latitude: geom.coordinates[1],
        longitude: geom.coordinates[0],
        description: `Регистриран сеизмички потрес со магнитуда M ${mag} на длабочина од ${depth} km во регионот ${regionName}. Координати: ${geom.coordinates[1].toFixed(3)}°N, ${geom.coordinates[0].toFixed(3)}°E.`
      });
    }
    console.log(`✅ Processed ${alerts.length} earthquake alerts from EMSC.`);
  } catch (err) {
    console.warn('EMSC fetch error:', err.message);
  }
  return alerts;
}

async function fetchRoadAlerts() {
  console.log('🚗 Fetching road condition alerts from AMSM...');
  const alerts = [];
  try {
    const res = await fetch('https://amsm.mk/sostojba-na-patishta/dnevni-informacii/', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error(`AMSM error: ${res.status}`);
    const html = await res.text();

    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    const rawItems = [];
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

    const now = new Date();

    for (const text of rawItems) {
      let matchedCity = 'Македонија';
      for (const city of MK_CITIES) {
        if (text.toLowerCase().includes(city.toLowerCase())) {
          matchedCity = city;
          break;
        }
      }

      // Detect road code: e.g. А1, А2, Р1201, Р1306, Коридор 10Д
      const roadMatch = text.match(/(?:пат|делница|правец)?\s*([АРA-Za-z]\d{1,4}[а-ја-я]?)\b/iu) || text.match(/\b([АРA-Za-z]\d{1,4})\b/iu);
      let roadCode = roadMatch ? roadMatch[1].toUpperCase() : '';
      if (!roadCode && text.includes('Коридор 10')) roadCode = 'Коридор 10';

      let title = 'Измена на режим на сообраќај';
      if (text.includes('свлечиште') || text.includes('одрон')) title = 'Опасност од одрони и свлечиште';
      else if (text.includes('мост')) title = 'Санација на мост / градежни работи';
      else if (text.includes('граничен премин')) title = 'Режим на сообраќај на граничен премин';
      else if (roadCode) title = `Работи на пат (${roadCode})`;

      const coords = CITY_COORDS[matchedCity] || CITY_COORDS['Скопје'];
      const alertId = generateId('rd', text.substring(0, 80));

      alerts.push({
        id: alertId,
        type: 'road',
        source: 'amsm',
        source_title: 'АМСМ · Сообраќај',
        title: title,
        city: matchedCity,
        location_name: matchedCity,
        address: text.length > 120 ? text.substring(0, 120) + '...' : text,
        start_time: now.toISOString(),
        end_time: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        voltage: roadCode || undefined,
        latitude: coords.lat,
        longitude: coords.lon,
        description: text
      });
    }

    console.log(`✅ Processed ${alerts.length} road alerts from AMSM.`);
  } catch (err) {
    console.warn('AMSM fetch error:', err.message);
  }
  return alerts;
}

async function run() {
  const power = await fetchPowerAlerts();
  const water = await fetchWaterAlerts();
  const earthquakes = await fetchEarthquakeAlerts();
  const roads = await fetchRoadAlerts();

  const allAlerts = [...power, ...water, ...earthquakes, ...roads].sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  console.log(`\n🎉 Total combined alerts: ${allAlerts.length}`);

  // Geocode all alerts with street or neighborhood coordinates if not already set
  console.log('📍 Geocoding alert locations...');
  for (let i = 0; i < allAlerts.length; i++) {
    if (!allAlerts[i].latitude || !allAlerts[i].longitude) {
      const coords = await geocodeAlert(allAlerts[i]);
      allAlerts[i].latitude = coords.latitude;
      allAlerts[i].longitude = coords.longitude;
    }
  }
  fs.writeFileSync(cachePath, JSON.stringify(geocodeCache, null, 2), 'utf8');
  console.log(`📍 Geocoding completed for ${allAlerts.length} alerts.`);

  // 1. Write fallback JSON for offline and cold-start bundled in app
  const targetDir = path.join(__dirname, '..', 'src', 'assets', 'data');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const targetFile = path.join(targetDir, 'utility_alerts.json');
  fs.writeFileSync(targetFile, JSON.stringify(allAlerts, null, 2), 'utf-8');
  console.log(`✅ Saved bundled fallback to ${targetFile}`);

  // 2. Generate Supabase SQL Migration
  const sqlFile = path.join(__dirname, '..', 'supabase', 'create_and_seed_utility_alerts.sql');
  let sql = `-- Table and RLS for Utility Alerts (Прекини и соопштенија за струја, вода, патишта, земјотреси)
CREATE TABLE IF NOT EXISTS public.utility_alerts (
  id text PRIMARY KEY,
  type text NOT NULL, -- 'power', 'water', 'road', 'earthquake', 'other'
  source text NOT NULL, -- 'elektrodistribucija', 'vodovod', 'amsm', 'emsc'
  source_title text NOT NULL,
  title text NOT NULL,
  city text NOT NULL,
  municipality text,
  location_name text,
  address text,
  start_time timestamptz,
  end_time timestamptz,
  status text DEFAULT 'upcoming', -- 'active', 'upcoming', 'resolved'
  voltage text,
  description text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure latitude/longitude columns exist if table was already created
ALTER TABLE public.utility_alerts ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.utility_alerts ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS idx_utility_alerts_city ON public.utility_alerts(city);
CREATE INDEX IF NOT EXISTS idx_utility_alerts_type ON public.utility_alerts(type);
CREATE INDEX IF NOT EXISTS idx_utility_alerts_status ON public.utility_alerts(status);
CREATE INDEX IF NOT EXISTS idx_utility_alerts_start ON public.utility_alerts(start_time);
CREATE INDEX IF NOT EXISTS idx_utility_alerts_coords ON public.utility_alerts(latitude, longitude);

ALTER TABLE public.utility_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'utility_alerts' AND policyname = 'Allow public read for utility_alerts'
  ) THEN
    CREATE POLICY "Allow public read for utility_alerts" ON public.utility_alerts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'utility_alerts' AND policyname = 'Allow service role write for utility_alerts'
  ) THEN
    CREATE POLICY "Allow service role write for utility_alerts" ON public.utility_alerts FOR ALL USING (true);
  END IF;
END $$;

GRANT ALL ON public.utility_alerts TO service_role;
GRANT SELECT ON public.utility_alerts TO anon, authenticated;

-- Seed Utility Alerts
INSERT INTO public.utility_alerts (
  id, type, source, source_title, title, city, municipality, location_name, address, start_time, end_time, status, voltage, description, latitude, longitude
) VALUES\n`;

  const rows = allAlerts.map(a => {
    const esc = (s) => (s ? `'${s.replace(/'/g, "''")}'` : 'NULL');
    const lat = a.latitude != null ? a.latitude : 'NULL';
    const lon = a.longitude != null ? a.longitude : 'NULL';
    return `(${esc(a.id)}, ${esc(a.type)}, ${esc(a.source)}, ${esc(a.source_title)}, ${esc(a.title)}, ${esc(a.city)}, ${esc(a.municipality)}, ${esc(a.location_name)}, ${esc(a.address)}, ${esc(a.start_time)}, ${esc(a.end_time)}, ${esc(a.status)}, ${esc(a.voltage)}, ${esc(a.description)}, ${lat}, ${lon})`;
  });

  sql += rows.join(',\n') + '\nON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, end_time = EXCLUDED.end_time, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now();\n';

  fs.writeFileSync(sqlFile, sql, 'utf-8');
  console.log(`✅ Generated SQL migration at ${sqlFile}`);
}

run();
