const https = require('https');
const fs = require('fs');
const path = require('path');

// Macedonian cities with lat/lng for nearest-city mapping
const MKD_CITIES = [
  { name: 'Берово', lat: 41.7028, lng: 22.8569 },
  { name: 'Битола', lat: 41.0311, lng: 21.3403 },
  { name: 'Богданци', lat: 41.2031, lng: 22.5756 },
  { name: 'Валандово', lat: 41.3169, lng: 22.5606 },
  { name: 'Велес', lat: 41.7156, lng: 21.7756 },
  { name: 'Виница', lat: 41.8828, lng: 22.5092 },
  { name: 'Гевгелија', lat: 41.1414, lng: 22.5019 },
  { name: 'Гостивар', lat: 41.7961, lng: 20.9083 },
  { name: 'Дебар', lat: 41.5250, lng: 20.5272 },
  { name: 'Делчево', lat: 41.9675, lng: 22.7744 },
  { name: 'Демир Капија', lat: 41.4114, lng: 22.2422 },
  { name: 'Демир Хисар', lat: 41.2208, lng: 21.2036 },
  { name: 'Кавадарци', lat: 41.4331, lng: 22.0119 },
  { name: 'Кичево', lat: 41.5139, lng: 20.9531 },
  { name: 'Кочани', lat: 41.9167, lng: 22.4125 },
  { name: 'Кратово', lat: 42.0783, lng: 22.1811 },
  { name: 'Крива Паланка', lat: 42.2011, lng: 22.3333 },
  { name: 'Крушево', lat: 41.3689, lng: 21.2486 },
  { name: 'Куманово', lat: 42.1322, lng: 21.7144 },
  { name: 'Македонска Каменица', lat: 42.0208, lng: 22.5878 },
  { name: 'Македонски Брод', lat: 41.5133, lng: 21.2153 },
  { name: 'Неготино', lat: 41.4844, lng: 22.0914 },
  { name: 'Охрид', lat: 41.1172, lng: 20.8019 },
  { name: 'Пехчево', lat: 41.7619, lng: 22.8875 },
  { name: 'Прилеп', lat: 41.3461, lng: 21.5542 },
  { name: 'Пробиштип', lat: 41.9961, lng: 22.1856 },
  { name: 'Радовиш', lat: 41.6383, lng: 22.4647 },
  { name: 'Ресен', lat: 41.0889, lng: 21.0108 },
  { name: 'Свети Николе', lat: 41.8650, lng: 21.9442 },
  { name: 'Скопје', lat: 42.0000, lng: 21.4333 },
  { name: 'Струга', lat: 41.1778, lng: 20.6789 },
  { name: 'Струмица', lat: 41.4375, lng: 22.6433 },
  { name: 'Тетово', lat: 42.0106, lng: 20.9714 },
  { name: 'Штип', lat: 41.7458, lng: 22.1994 }
];

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function findNearestCity(lat, lng) {
  let minDistance = Infinity;
  let nearestCity = 'Скопје';
  for (const city of MKD_CITIES) {
    const dist = calcDistance(lat, lng, city.lat, city.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestCity = city.name;
    }
  }
  return nearestCity;
}

function normalizeBrand(rawBrand, rawName, rawOperator) {
  const text = `${rawBrand || ''} ${rawName || ''} ${rawOperator || ''}`.toLowerCase();
  
  if (text.includes('макпетрол') || text.includes('makpetrol')) {
    return { brand: 'Макпетрол', chain: 'makpetrol' };
  }
  if (text.includes('лукоил') || text.includes('lukoil')) {
    return { brand: 'Лукоил', chain: 'lukoil' };
  }
  if (text.includes('окта') || text.includes('okta')) {
    return { brand: 'ОКТА', chain: 'okta' };
  }
  if (text.includes('детоил') || text.includes('detoil')) {
    return { brand: 'Детоил', chain: 'detoil' };
  }
  if (text.includes('пуцко') || text.includes('pucko')) {
    return { brand: 'Пуцко Петрол', chain: 'pucko' };
  }
  if (text.includes('каст') || text.includes('kast')) {
    return { brand: 'Каст Експрес', chain: 'kast' };
  }
  if (text.includes('гулф') || text.includes('gulf')) {
    return { brand: 'Гулф', chain: 'gulf' };
  }
  if (text.includes('шел') || text.includes('shell')) {
    return { brand: 'Шел', chain: 'shell' };
  }
  if (text.includes('петрол') || text.includes('petrol') || text.includes('оил') || text.includes('oil')) {
    const cleanName = (rawBrand || rawName || 'Бензинска пумпа').trim();
    return { brand: cleanName, chain: 'other' };
  }
  return { brand: rawBrand || rawName || 'Бензинска пумпа', chain: 'other' };
}

const mkPolygon = JSON.parse(fs.readFileSync(path.join(__dirname, 'mk_polygon.json'), 'utf-8'));

function isInsideMacedonia(lat, lng) {
  let inside = false;
  for (let i = 0, j = mkPolygon.length - 1; i < mkPolygon.length; j = i++) {
    const xi = mkPolygon[i][0], yi = mkPolygon[i][1];
    const xj = mkPolygon[j][0], yj = mkPolygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

async function fetchFromOverpass() {
  const query = `[out:json][timeout:35][bbox:40.85,20.45,42.36,23.03];
(
  node["amenity"="fuel"];
  way["amenity"="fuel"];
);
out center tags;`;

  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.osm.ch/api/interpreter'
  ];

  const postData = 'data=' + encodeURIComponent(query);

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying Overpass endpoint: ${endpoint}...`);
      const data = await new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const options = {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'DzebleApp/1.0 (contact: info@dzeble.com)'
          },
          timeout: 30000
        };

        const req = https.request(options, (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Status ${res.statusCode}`));
          }
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });

        req.write(postData);
        req.end();
      });

      if (data && data.elements && data.elements.length > 0) {
        console.log(`Successfully fetched ${data.elements.length} stations from ${endpoint}!`);
        return data.elements;
      }
    } catch (err) {
      console.warn(`Failed on ${endpoint}: ${err.message}. Trying next...`);
    }
  }

  throw new Error('All Overpass endpoints failed.');
}

async function run() {
  const elements = await fetchFromOverpass();

  const stations = [];
  const seenCoords = new Set();

  for (const el of elements) {
    const lat = el.lat || el.center?.lat;
    const lng = el.lon || el.center?.lon;
    if (!lat || !lng) continue;

    // Filter strictly inside North Macedonia polygon
    if (!isInsideMacedonia(lat, lng)) continue;

    // Deduplicate by close coords
    const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seenCoords.has(coordKey)) continue;
    seenCoords.add(coordKey);

    const tags = el.tags || {};
    const rawBrand = tags.brand || tags['brand:en'] || tags['brand:mk'];
    const rawName = tags.name || tags['name:mk'] || tags['name:en'] || tags.operator;
    const rawOperator = tags.operator || tags.operator_name;

    const { brand, chain } = normalizeBrand(rawBrand, rawName, rawOperator);

    let displayName = rawName || brand;
    if (!displayName || displayName === 'Бензинска пумпа') {
      displayName = brand !== 'Останати' ? brand : 'Бензинска станица';
    }

    // City determination
    let city = tags['addr:city'] || tags['addr:city:mk'] || tags['is_in:city'];
    if (!city) {
      city = findNearestCity(lat, lng);
    }

    // Address
    let address = tags['addr:street'] || '';
    if (tags['addr:housenumber']) {
      address += ' ' + tags['addr:housenumber'];
    }
    if (!address.trim()) {
      address = `Регион ${city}`;
    }

    // Hours
    const openingHours = tags.opening_hours || '';
    const is24_7 = openingHours.includes('24/7') || 
                   ['makpetrol', 'lukoil', 'okta'].includes(chain) ||
                   openingHours.includes('00:00-24:00') ||
                   !openingHours;

    // Services
    const hasLpg = tags['fuel:lpg'] === 'yes' || tags['fuel:autogas'] === 'yes' || tags['fuel:cng'] === 'yes';
    const hasCng = tags['fuel:cng'] === 'yes' || tags['fuel:methane'] === 'yes';
    const hasEv = tags['fuel:electricity'] === 'yes' || tags['charging_station'] === 'yes' || tags['socket:type2'] != null;
    const hasCarWash = tags.car_wash === 'yes' || tags['service:vehicle:car_wash'] === 'yes';
    const hasShop = tags.shop != null || ['makpetrol', 'lukoil', 'okta'].includes(chain);

    stations.push({
      id: `gas_${el.id}`,
      name: displayName,
      brand: brand,
      chain: chain,
      city: city,
      address: address.trim(),
      latitude: lat,
      longitude: lng,
      is_24_7: is24_7,
      working_hours: openingHours || (is24_7 ? '24/7' : '06:00 - 22:00'),
      has_lpg: hasLpg,
      has_cng: hasCng,
      has_ev: hasEv,
      has_car_wash: hasCarWash,
      has_shop: hasShop,
      phone: tags.phone || tags['contact:phone'] || null
    });
  }

  // Sort by brand then city
  stations.sort((a, b) => a.brand.localeCompare(b.brand) || a.city.localeCompare(b.city));

  console.log(`Processed ${stations.length} unique gas stations across Macedonia!`);

  // 1. Write to src/assets/data/gas_stations.json
  const assetsDir = path.join(__dirname, '..', 'src', 'assets', 'data');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  const jsonPath = path.join(assetsDir, 'gas_stations.json');
  fs.writeFileSync(jsonPath, JSON.stringify(stations, null, 2), 'utf-8');
  console.log(`Saved JSON data to ${jsonPath}`);

  // 2. Generate Supabase SQL migration & seed
  const sqlDir = path.join(__dirname, '..', 'supabase');
  if (!fs.existsSync(sqlDir)) {
    fs.mkdirSync(sqlDir, { recursive: true });
  }

  let sql = `-- Table and RLS for Gas Stations (Бензински пумпи)
CREATE TABLE IF NOT EXISTS public.gas_stations (
  id text PRIMARY KEY,
  name text NOT NULL,
  brand text NOT NULL,
  chain text DEFAULT 'other',
  city text NOT NULL,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  is_24_7 boolean DEFAULT true,
  working_hours text DEFAULT '24/7',
  has_lpg boolean DEFAULT false,
  has_cng boolean DEFAULT false,
  has_ev boolean DEFAULT false,
  has_car_wash boolean DEFAULT false,
  has_shop boolean DEFAULT false,
  phone text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gas_stations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gas_stations' AND policyname = 'Allow public read for gas_stations'
  ) THEN
    CREATE POLICY "Allow public read for gas_stations" ON public.gas_stations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gas_stations' AND policyname = 'Allow service role write for gas_stations'
  ) THEN
    CREATE POLICY "Allow service role write for gas_stations" ON public.gas_stations FOR ALL USING (true);
  END IF;
END $$;

GRANT ALL ON public.gas_stations TO service_role;
GRANT SELECT ON public.gas_stations TO anon, authenticated;

-- Seed Gas Stations
INSERT INTO public.gas_stations (
  id, name, brand, chain, city, address, latitude, longitude, is_24_7, working_hours, has_lpg, has_cng, has_ev, has_car_wash, has_shop, phone
) VALUES
`;

  const escapeSql = (str) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';

  const rows = stations.map(s => {
    return `(${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.brand)}, ${escapeSql(s.chain)}, ${escapeSql(s.city)}, ${escapeSql(s.address)}, ${s.latitude}, ${s.longitude}, ${s.is_24_7}, ${escapeSql(s.working_hours)}, ${s.has_lpg}, ${s.has_cng}, ${s.has_ev}, ${s.has_car_wash}, ${s.has_shop}, ${escapeSql(s.phone)})`;
  });

  sql += rows.join(',\n') + '\nON CONFLICT (id) DO UPDATE SET\n  name = EXCLUDED.name,\n  brand = EXCLUDED.brand,\n  chain = EXCLUDED.chain,\n  city = EXCLUDED.city,\n  address = EXCLUDED.address,\n  latitude = EXCLUDED.latitude,\n  longitude = EXCLUDED.longitude,\n  is_24_7 = EXCLUDED.is_24_7,\n  working_hours = EXCLUDED.working_hours,\n  has_lpg = EXCLUDED.has_lpg,\n  has_cng = EXCLUDED.has_cng,\n  has_ev = EXCLUDED.has_ev,\n  has_car_wash = EXCLUDED.has_car_wash,\n  has_shop = EXCLUDED.has_shop,\n  phone = EXCLUDED.phone;\n';

  const sqlPath = path.join(sqlDir, 'create_and_seed_gas_stations.sql');
  fs.writeFileSync(sqlPath, sql, 'utf-8');
  console.log(`Saved SQL migration and seed to ${sqlPath}`);
}

run().catch(err => {
  console.error('Fatal crawler error:', err);
  process.exit(1);
});
