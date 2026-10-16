const fs = require('fs');
const path = require('path');

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

const jsonPath = path.join(__dirname, '..', 'src', 'assets', 'data', 'gas_stations.json');
const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

console.log('Initial count:', raw.length);

const cleaned = [];
for (const s of raw) {
  if (!isInsideMacedonia(s.latitude, s.longitude)) {
    continue;
  }

  // Clean quotes or weird names
  let name = s.name.replace(/^["']|["']$/g, '').trim();
  let brand = s.brand.replace(/^["']|["']$/g, '').trim();

  // If brand is generic or unknown, give it proper label
  if (!brand || brand === 'fuel' || brand === 'yes') {
    brand = 'Бензинска станица';
  }
  if (!name || name === 'fuel' || name === 'yes') {
    name = brand;
  }

  // Normalize chain key
  const lower = `${brand} ${name}`.toLowerCase();
  let chain = s.chain;
  if (lower.includes('макпетрол') || lower.includes('makpetrol')) chain = 'makpetrol';
  else if (lower.includes('лукоил') || lower.includes('lukoil')) chain = 'lukoil';
  else if (lower.includes('окта') || lower.includes('okta')) chain = 'okta';
  else if (lower.includes('детоил') || lower.includes('detoil')) chain = 'detoil';
  else if (lower.includes('пуцко') || lower.includes('pucko')) chain = 'pucko';
  else if (lower.includes('каст') || lower.includes('kast')) chain = 'kast';
  else if (lower.includes('гулф') || lower.includes('gulf')) chain = 'gulf';
  else if (lower.includes('шел') || lower.includes('shell')) chain = 'shell';
  else chain = 'other';

  cleaned.push({
    ...s,
    name,
    brand,
    chain
  });
}

console.log('Cleaned count strictly inside Macedonia:', cleaned.length);

// Sort by brand then city
cleaned.sort((a, b) => a.brand.localeCompare(b.brand) || a.city.localeCompare(b.city));

// Write back to json
fs.writeFileSync(jsonPath, JSON.stringify(cleaned, null, 2), 'utf-8');
console.log('Updated', jsonPath);

// Generate SQL
const escapeSql = (str) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';

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

const rows = cleaned.map(s => {
  return `(${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.brand)}, ${escapeSql(s.chain)}, ${escapeSql(s.city)}, ${escapeSql(s.address)}, ${s.latitude}, ${s.longitude}, ${s.is_24_7}, ${escapeSql(s.working_hours)}, ${s.has_lpg}, ${s.has_cng}, ${s.has_ev}, ${s.has_car_wash}, ${s.has_shop}, ${escapeSql(s.phone)})`;
});

sql += rows.join(',\n') + '\nON CONFLICT (id) DO UPDATE SET\n  name = EXCLUDED.name,\n  brand = EXCLUDED.brand,\n  chain = EXCLUDED.chain,\n  city = EXCLUDED.city,\n  address = EXCLUDED.address,\n  latitude = EXCLUDED.latitude,\n  longitude = EXCLUDED.longitude,\n  is_24_7 = EXCLUDED.is_24_7,\n  working_hours = EXCLUDED.working_hours,\n  has_lpg = EXCLUDED.has_lpg,\n  has_cng = EXCLUDED.has_cng,\n  has_ev = EXCLUDED.has_ev,\n  has_car_wash = EXCLUDED.has_car_wash,\n  has_shop = EXCLUDED.has_shop,\n  phone = EXCLUDED.phone;\n';

const sqlPath = path.join(__dirname, '..', 'supabase', 'create_and_seed_gas_stations.sql');
fs.writeFileSync(sqlPath, sql, 'utf-8');
console.log('Updated', sqlPath);
