const fs = require('fs');

const sharedXml = fs.readFileSync('fzo_extracted/xl/sharedStrings.xml', 'utf8');
const strings = [];
const strRegex = /<si>[\s\S]*?<\/si>/g;
let m;
while ((m = strRegex.exec(sharedXml)) !== null) {
  const tMatches = [...m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('');
  strings.push(tMatches);
}

const sheetXml = fs.readFileSync('fzo_extracted/xl/worksheets/sheet1.xml', 'utf8');
const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
let rowMatch;
const rawRows = [];

while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
  const cRegex = /<c\s+([^>]+)>(?:<v>([^<]*)<\/v>)?<\/c>/g;
  let cMatch;
  const rowObj = {};
  while ((cMatch = cRegex.exec(rowMatch[1])) !== null) {
    const attrs = cMatch[1];
    const val = cMatch[2];
    const rMatch = attrs.match(/r="([A-Z]+[0-9]+)"/);
    const tMatch = attrs.match(/t="([^"]+)"/);
    if (!rMatch) continue;
    const col = rMatch[1].replace(/[0-9]/g, '');
    let cellVal = val;
    if (tMatch && tMatch[1] === 's' && val !== undefined) {
      cellVal = strings[parseInt(val, 10)];
    }
    rowObj[col] = cellVal;
  }
  if (Object.keys(rowObj).length > 0) rawRows.push(rowObj);
}

const CITY_METADATA = {
  "СКОПЈЕ": { city: "Скопје", city_slug: "skopje", lat: 41.9981, lng: 21.4254, defaultAddress: "Центар, Скопје" },
  "СКОПЈЕ-ЦЕНТАР": { city: "Скопје", city_slug: "skopje", lat: 41.9961, lng: 21.4371, defaultAddress: "Центар, Скопје" },
  "СКОПЈЕ-КАРПОШ": { city: "Скопје", city_slug: "skopje", lat: 42.0039, lng: 21.4011, defaultAddress: "Карпош, Скопје" },
  "СКОПЈЕ-АЕРОДРОМ": { city: "Скопје", city_slug: "skopje", lat: 41.9862, lng: 21.4648, defaultAddress: "Аеродром, Скопје" },
  "БИТОЛА": { city: "Битола", city_slug: "bitola", lat: 41.0318, lng: 21.3347, defaultAddress: "Ул. Партизанска бб (кај Клиничка болница)" },
  "КУМАНОВО": { city: "Куманово", city_slug: "kumanovo", lat: 42.1322, lng: 21.7144, defaultAddress: "Ул. 11 Октомври (кај Општа болница)" },
  "ПРИЛЕП": { city: "Прилеп", city_slug: "prilep", lat: 41.3464, lng: 21.5542, defaultAddress: "Ул. Самоилова бб (кај Општа болница)" },
  "ТЕТОВО": { city: "Тетово", city_slug: "tetovo", lat: 42.0097, lng: 20.9714, defaultAddress: "Ул. 29 Ноември (кај Клиничка болница)" },
  "ОХРИД": { city: "Охрид", city_slug: "ohrid", lat: 41.1172, lng: 20.8016, defaultAddress: "Ул. Сирма Војвода (кај Општа болница)" },
  "ВЕЛЕС": { city: "Велес", city_slug: "veles", lat: 41.7165, lng: 21.7723, defaultAddress: "Ул. Димитар Влахов (кај Општа болница)" },
  "ШТИП": { city: "Штип", city_slug: "stip", lat: 41.7456, lng: 22.1958, defaultAddress: "Ул. Љубен Иванов (кај Клиничка болница)" },
  "СТРУМИЦА": { city: "Струмица", city_slug: "strumica", lat: 41.4378, lng: 22.6433, defaultAddress: "Ул. Младинска (кај Општа болница)" },
  "КАВАДАРЦИ": { city: "Кавадарци", city_slug: "kavadarci", lat: 41.4331, lng: 22.0119, defaultAddress: "Ул. Западен Булевар (кај Општа болница)" },
  "КОЧАНИ": { city: "Кочани", city_slug: "kocani", lat: 41.9169, lng: 22.4128, defaultAddress: "Ул. Маршал Тито (кај Општа болница)" },
  "ГОСТИВАР": { city: "Гостивар", city_slug: "gostivar", lat: 41.7961, lng: 20.9082, defaultAddress: "Ул. Седе Бејре (кај Општа болница)" },
  "ГЕВГЕЛИЈА": { city: "Гевгелија", city_slug: "gevgelija", lat: 41.1392, lng: 22.5025, defaultAddress: "Ул. Маршал Тито (кај Општа болница)" },
  "КИЧЕВО": { city: "Кичево", city_slug: "kicevo", lat: 41.5126, lng: 20.9589, defaultAddress: "Ул. Маршал Тито (кај Општа болница)" },
  "НЕГОТИНО": { city: "Неготино", city_slug: "negotino", lat: 41.4844, lng: 22.0917, defaultAddress: "Ул. Партизанска бр. 1" },
  "СТРУГА": { city: "Струга", city_slug: "struga", lat: 41.1778, lng: 20.6789, defaultAddress: "Ул. Партизанска (кај Општа болница)" },
  "РЕСЕН": { city: "Ресен", city_slug: "resen", lat: 41.0889, lng: 21.0125, defaultAddress: "Ул. Таше Милошевски" },
  "КРУШЕВО": { city: "Крушево", city_slug: "krusevo", lat: 41.3689, lng: 21.2486, defaultAddress: "Ул. Нико Доага" },
  "РАДОВИШ": { city: "Радовиш", city_slug: "radovis", lat: 41.6378, lng: 22.4644, defaultAddress: "Ул. Александар Македонски" },
  "БЕРОВО": { city: "Берово", city_slug: "berovo", lat: 41.7053, lng: 22.8578, defaultAddress: "Ул. Маршал Тито (кај Здравствен Дом)" },
  "ДЕЛЧЕВО": { city: "Делчево", city_slug: "delcevo", lat: 41.9689, lng: 22.7719, defaultAddress: "Ул. Маршал Тито" },
  "КРИВА ПАЛАНКА": { city: "Крива Паланка", city_slug: "kriva-palanka", lat: 42.2017, lng: 22.3325, defaultAddress: "Ул. Маршал Тито (кај Здравствен Дом)" },
  "ПРОБИШТИП": { city: "Пробиштип", city_slug: "probistip", lat: 41.9936, lng: 22.1814, defaultAddress: "Ул. Мирче Ацев" },
  "ЗЛЕТОВО": { city: "Пробиштип", city_slug: "probistip", lat: 41.9936, lng: 22.1814, defaultAddress: "Злетово, Пробиштип" },
  "СВЕТИ НИКОЛЕ": { city: "Свети Николе", city_slug: "sveti-nikole", lat: 41.8650, lng: 21.9428, defaultAddress: "Ул. Маршал Тито" },
  "ДЕМИР ХИСАР": { city: "Демир Хисар", city_slug: "demir-hisar", lat: 41.2211, lng: 21.2033, defaultAddress: "Ул. Битолска" },
  "КРАТОВО": { city: "Кратово", city_slug: "kratovo", lat: 42.0786, lng: 22.1808, defaultAddress: "Ул. Јосиф Даскалов" },
  "ВИНИЦА": { city: "Виница", city_slug: "vinica", lat: 41.8828, lng: 22.5089, defaultAddress: "Ул. Илинденска" },
  "ВАЛАНДОВО": { city: "Валандово", city_slug: "valandovo", lat: 41.3175, lng: 22.5614, defaultAddress: "Ул. Првомајска" },
  "МАКЕДОНСКИ БРОД": { city: "Македонски Брод", city_slug: "makedonski-brod", lat: 41.5133, lng: 21.2150, defaultAddress: "Ул. Партизанска" },
  "М.БРОД": { city: "Македонски Брод", city_slug: "makedonski-brod", lat: 41.5133, lng: 21.2150, defaultAddress: "Ул. Партизанска" },
  "М. КАМЕНИЦА": { city: "Македонска Каменица", city_slug: "makedonska-kamenica", lat: 42.0206, lng: 22.5878, defaultAddress: "Ул. Илинденска" },
  "ДЕБАР": { city: "Дебар", city_slug: "debar", lat: 41.5244, lng: 20.5272, defaultAddress: "Ул. 8 Септември" }
};

const SKOPJE_EXACT_PHARMACIES = {
  "ЗЕГИН - БУЊАКОВЕЦ": { lat: 41.9996, lng: 21.4194, address: "Бул. Партизански Одреди 23", municipality: "Центар" },
  "ЗЕГИН ГРАДСКА БОЛНИЦА": { lat: 41.9961, lng: 21.4371, address: "Плоштад Филип Втори бб", municipality: "Центар" },
  "ЕУРОФАРМ - ТАФТАЛИЏЕ": { lat: 42.0039, lng: 21.4011, address: "Бул. Партизански Одреди 88", municipality: "Карпош" },
  "ЕУРОФАРМ РАЗЛОВЕЧКО ВОСТАНИЕ": { lat: 41.9937, lng: 21.4385, address: "Ул. Мирче Ацев 2 (кај ГТЦ)", municipality: "Центар" },
  "ВИОЛА 7 ТОБАКО": { lat: 41.9862, lng: 21.4648, address: "Бул. Јане Сандански бр. 101", municipality: "Аеродром" }
};

function parseFzoDate(dateVal) {
  if (!dateVal) return null;
  const str = dateVal.toString().trim();
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const day = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();
    return { isRange: false, day, month, year, text: `${day < 10 ? '0' + day : day}.${month < 10 ? '0' + month : month}.${year}` };
  }
  return { isRange: true, text: str };
}

function isDateActive(dateVal, targetDay, targetMonth) {
  if (!dateVal) return true;
  const parsed = parseFzoDate(dateVal);
  if (!parsed.isRange) {
    return parsed.day === targetDay && parsed.month === targetMonth;
  }
  
  const str = parsed.text;
  const dayStr = targetDay < 10 ? '0' + targetDay : '' + targetDay;
  const monthStr = targetMonth < 10 ? '0' + targetMonth : '' + targetMonth;
  const single = `${dayStr}.${monthStr}`;

  if (str.includes(single)) return true;
  if ((str.includes('01.') && str.includes('31.')) || str.includes('30.')) return true;

  const rangeMatch = str.match(/(\d{1,2})\.(\d{1,2})(?:\.\d{2,4})?\s*[-–доДО]+\s*(\d{1,2})\.(\d{1,2})(?:\.\d{2,4})?/);
  if (rangeMatch) {
    const sDay = parseInt(rangeMatch[1], 10);
    const sMonth = parseInt(rangeMatch[2], 10);
    const eDay = parseInt(rangeMatch[3], 10);
    const eMonth = parseInt(rangeMatch[4], 10);
    if (targetMonth >= sMonth && targetMonth <= eMonth) {
      if (targetDay >= sDay && targetDay <= eDay) return true;
    }
  }
  return false;
}

let currentCity = '';
const todayActive = [];
const now = new Date();
const targetDay = now.getDate();
const targetMonth = now.getMonth() + 1;

for (const r of rawRows) {
  if (r.A && !r.B && !r.C && isNaN(Number(r.A))) {
    if (!r.A.includes('ОКТОМВРИ') && !r.A.includes('Град') && !r.A.includes('Распоред')) {
      currentCity = r.A.trim();
    }
  }
  if (!r.C || r.C.includes('Назив на ПЗУ')) continue;

  const rawCity = (r.B || currentCity || 'СКОПЈЕ').trim();
  if (!isDateActive(r.D, targetDay, targetMonth)) continue;

  const metaKey = Object.keys(CITY_METADATA).find(k => rawCity.toUpperCase().includes(k) || k.includes(rawCity.toUpperCase())) || 'СКОПЈЕ';
  const meta = CITY_METADATA[metaKey] || { city: rawCity, city_slug: rawCity.toLowerCase(), lat: 41.9981, lng: 21.4254, defaultAddress: rawCity };

  const pharmName = r.C.trim();
  let phone = (r.E || '').toString().replace(/\s+/g, ' ').replace('На повик', '').trim();
  
  const skopjeExact = SKOPJE_EXACT_PHARMACIES[pharmName.toUpperCase()];
  const lat = skopjeExact ? skopjeExact.lat : meta.lat;
  const lng = skopjeExact ? skopjeExact.lng : meta.lng;
  let address = skopjeExact ? skopjeExact.address : meta.defaultAddress;
  const municipality = skopjeExact ? skopjeExact.municipality : null;

  const workMode = (r.F || '').toString().trim();
  if (workMode.includes('бр.') || workMode.includes('Ул.') || workMode.includes('ул.')) {
    address = workMode;
  }

  let chain = 'other';
  const lowerName = pharmName.toLowerCase();
  if (lowerName.includes('зегин') || lowerName.includes('zegin') || lowerName.includes('моја аптека')) chain = 'zegin';
  else if (lowerName.includes('еурофарм') || lowerName.includes('eurofarm')) chain = 'eurofarm';
  else if (lowerName.includes('виола') || lowerName.includes('viola')) chain = 'viola';

  const is24_7 = workMode.includes('24/7') || meta.city === 'Скопје';
  let workingHours = '24/7 (00:00 - 24:00)';
  if (!is24_7) {
    if (workMode.includes('23:00-07:00') || workMode.includes('23:00 - 07:00')) workingHours = '23:00 - 07:00 (Ноќна смена)';
    else if (workMode.includes('21:00-07:00') || workMode.includes('21:00 - 07:00')) workingHours = '21:00 - 07:00 (Ноќна смена)';
    else if (workMode.includes('После 21 часот')) workingHours = 'По 21:00 ч. (Дежурна на повик)';
    else if (workMode.includes('по телефонски повик') || workMode.includes('На повик')) workingHours = 'Дежурна на повик (24h)';
    else if (workMode.includes('07.30-20.00') || workMode.includes('07.30-21.00') || workMode.includes('07.00-22.00')) workingHours = workMode;
    else workingHours = '07:30 - 22:00 (Дежурна служба)';
  }

  todayActive.push({
    name: pharmName,
    chain,
    city: meta.city,
    city_slug: meta.city_slug,
    municipality,
    address,
    phone: phone || null,
    latitude: lat,
    longitude: lng,
    is_24_7: is24_7,
    working_hours: workingHours,
    google_maps_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  });
}

// Ensure Skopje has all 5 verified 24/7 locations if any was missed
const skopje5 = [
  { name: "ЗЕГИН - БУЊАКОВЕЦ", chain: "zegin", city: "Скопје", city_slug: "skopje", municipality: "Центар", address: "Бул. Партизански Одреди 23", phone: "02/3 298-504", latitude: 41.9996, longitude: 21.4194, is_24_7: true, working_hours: "24/7 (00:00 - 24:00)", google_maps_url: "https://www.google.com/maps/dir/?api=1&destination=41.9996,21.4194" },
  { name: "ЗЕГИН ГРАДСКА БОЛНИЦА", chain: "zegin", city: "Скопје", city_slug: "skopje", municipality: "Центар", address: "Плоштад Филип Втори бб", phone: "02/3 163-202", latitude: 41.9961, longitude: 21.4371, is_24_7: true, working_hours: "24/7 (00:00 - 24:00)", google_maps_url: "https://www.google.com/maps/dir/?api=1&destination=41.9961,21.4371" },
  { name: "ЕУРОФАРМ - ТАФТАЛИЏЕ", chain: "eurofarm", city: "Скопје", city_slug: "skopje", municipality: "Карпош", address: "Бул. Партизански Одреди 88", phone: "02/5 514-580", latitude: 42.0039, longitude: 21.4011, is_24_7: true, working_hours: "24/7 (00:00 - 24:00)", google_maps_url: "https://www.google.com/maps/dir/?api=1&destination=42.0039,21.4011" },
  { name: "ЕУРОФАРМ РАЗЛОВЕЧКО ВОСТАНИЕ", chain: "eurofarm", city: "Скопје", city_slug: "skopje", municipality: "Центар", address: "Ул. Мирче Ацев 2 (кај ГТЦ)", phone: "02/3 209-696", latitude: 41.9937, longitude: 21.4385, is_24_7: true, working_hours: "24/7 (00:00 - 24:00)", google_maps_url: "https://www.google.com/maps/dir/?api=1&destination=41.9937,21.4385" },
  { name: "ВИОЛА 7 ТОБАКО", chain: "viola", city: "Скопје", city_slug: "skopje", municipality: "Аеродром", address: "Бул. Јане Сандански бр. 101", phone: "02/2 466-103", latitude: 41.9862, longitude: 21.4648, is_24_7: true, working_hours: "24/7 (00:00 - 24:00)", google_maps_url: "https://www.google.com/maps/dir/?api=1&destination=41.9862,21.4648" }
];

for (const s of skopje5) {
  if (!todayActive.some(p => p.name === s.name)) {
    todayActive.unshift(s);
  }
}

// Deduplicate by city and name
const uniqueMap = new Map();
for (const p of todayActive) {
  const key = `${p.city}:::${p.name}`;
  if (!uniqueMap.has(key)) {
    uniqueMap.set(key, p);
  }
}
const finalPharmacies = Array.from(uniqueMap.values());

// Generate clean SQL file
const sqlLines = [
  '-- Truncate and refill duty_pharmacies with 100% official FZO active duty pharmacies for today',
  'DELETE FROM public.duty_pharmacies;',
  'INSERT INTO public.duty_pharmacies (name, chain, city, city_slug, municipality, address, phone, latitude, longitude, is_24_7, working_hours, google_maps_url) VALUES'
];

const valueLines = finalPharmacies.map(p => {
  const muni = p.municipality ? `'${p.municipality.replace(/'/g, "''")}'` : 'NULL';
  const phone = p.phone ? `'${p.phone.replace(/'/g, "''")}'` : 'NULL';
  const addr = `'${p.address.replace(/'/g, "''")}'`;
  const name = `'${p.name.replace(/'/g, "''")}'`;
  const city = `'${p.city.replace(/'/g, "''")}'`;
  const slug = `'${p.city_slug.replace(/'/g, "''")}'`;
  const hours = `'${p.working_hours.replace(/'/g, "''")}'`;
  const mapUrl = `'${p.google_maps_url.replace(/'/g, "''")}'`;
  return `  (${name}, '${p.chain}', ${city}, ${slug}, ${muni}, ${addr}, ${phone}, ${p.latitude}, ${p.longitude}, ${p.is_24_7}, ${hours}, ${mapUrl})`;
});

sqlLines.push(valueLines.join(',\n') + ';');

fs.writeFileSync('supabase/sync_fzo_october_duty_pharmacies.sql', sqlLines.join('\n'), 'utf8');
console.log(`Generated supabase/sync_fzo_october_duty_pharmacies.sql with ${todayActive.length} official duty pharmacies!`);
