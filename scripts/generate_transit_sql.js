const fs = require('fs');
const ts = require('typescript');

const source = fs.readFileSync('src/app/services/transit-lines.data.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

const m = { exports: {} };
const fn = new Function('module', 'exports', js);
fn(m, m.exports);
const lines = m.exports.ALL_JSP_LINES;

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJson(obj) {
  if (obj === null || obj === undefined) return "'[]'::jsonb";
  const json = JSON.stringify(obj).replace(/'/g, "''");
  return "'" + json + "'::jsonb";
}

let sql = `-- ========================================================
-- DZEBLE PUBLIC TRANSIT TABLES AND INITIAL SEED
-- Tables: transit_lines, transit_stops
-- ========================================================

-- 1. Table: transit_lines
CREATE TABLE IF NOT EXISTS public.transit_lines (
  id text PRIMARY KEY,
  number text NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'city',
  badge_color text DEFAULT '#10b981',
  route text NOT NULL,
  frequency text NOT NULL,
  first_departure text NOT NULL,
  last_departure text NOT NULL,
  stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  departures_workday jsonb NOT NULL DEFAULT '[]'::jsonb,
  departures_weekend jsonb NOT NULL DEFAULT '[]'::jsonb,
  direction_a jsonb NOT NULL DEFAULT '{}'::jsonb,
  direction_b jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transit_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transit_lines' AND policyname = 'Allow public read for transit_lines'
  ) THEN
    CREATE POLICY "Allow public read for transit_lines" ON public.transit_lines FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transit_lines' AND policyname = 'Allow service role write for transit_lines'
  ) THEN
    CREATE POLICY "Allow service role write for transit_lines" ON public.transit_lines FOR ALL USING (true);
  END IF;
END $$;

GRANT ALL ON public.transit_lines TO service_role;
GRANT SELECT ON public.transit_lines TO anon, authenticated;

-- 2. Table: transit_stops
CREATE TABLE IF NOT EXISTS public.transit_stops (
  id text PRIMARY KEY,
  name text NOT NULL,
  direction text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.transit_stops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transit_stops' AND policyname = 'Allow public read for transit_stops'
  ) THEN
    CREATE POLICY "Allow public read for transit_stops" ON public.transit_stops FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transit_stops' AND policyname = 'Allow service role write for transit_stops'
  ) THEN
    CREATE POLICY "Allow service role write for transit_stops" ON public.transit_stops FOR ALL USING (true);
  END IF;
END $$;

GRANT ALL ON public.transit_stops TO service_role;
GRANT SELECT ON public.transit_stops TO anon, authenticated;

-- 3. SEED 110 JSP SKOPJE BUS LINES
`;

lines.forEach(l => {
  sql += `INSERT INTO public.transit_lines (id, number, title, type, badge_color, route, frequency, first_departure, last_departure, stops, departures_workday, departures_weekend, direction_a, direction_b)
VALUES (
  ${escapeSql(l.id)},
  ${escapeSql(l.number)},
  ${escapeSql(l.title)},
  ${escapeSql(l.type)},
  ${escapeSql(l.badgeColor)},
  ${escapeSql(l.route)},
  ${escapeSql(l.frequency)},
  ${escapeSql(l.firstDeparture)},
  ${escapeSql(l.lastDeparture)},
  ${escapeJson(l.stops)},
  ${escapeJson(l.departuresWorkday)},
  ${escapeJson(l.departuresWeekend)},
  ${escapeJson(l.directionA)},
  ${escapeJson(l.directionB)}
)
ON CONFLICT (id) DO UPDATE SET
  number = EXCLUDED.number,
  title = EXCLUDED.title,
  type = EXCLUDED.type,
  badge_color = EXCLUDED.badge_color,
  route = EXCLUDED.route,
  frequency = EXCLUDED.frequency,
  first_departure = EXCLUDED.first_departure,
  last_departure = EXCLUDED.last_departure,
  stops = EXCLUDED.stops,
  departures_workday = EXCLUDED.departures_workday,
  departures_weekend = EXCLUDED.departures_weekend,
  direction_a = EXCLUDED.direction_a,
  direction_b = EXCLUDED.direction_b,
  updated_at = now();
`;
});

// Seed Key Stops
const jspStops = [
  { id: 'rekord-w', name: 'Центар Рекорд (кон Запад)', direction: 'кон Влае / Ѓорче', latitude: 41.99478, longitude: 21.43010, lines: ['2', '4', '5', '7', '15', '22', '24', '57', '60'] },
  { id: 'rekord-e', name: 'Центар Рекорд (кон Исток)', direction: 'кон Аеродром / Лисиче', latitude: 41.99434, longitude: 21.43150, lines: ['2', '4', '5', '7', '15', '22', '24', '57'] },
  { id: 'jugodrvo', name: 'Југодрво (Олимписки базен)', direction: 'кон Центар / Аеродром', latitude: 41.99238, longitude: 21.43838, lines: ['2', '5', '7', '15', '22'] },
  { id: 'transporten', name: 'Транспортен Центар (Жел. Станица)', direction: 'Автобуска станица', latitude: 41.99185, longitude: 21.44600, lines: ['7', '22', '41', '60'] },
  { id: 'soborna', name: 'Соборна Црква', direction: 'Партизанска', latitude: 41.99840, longitude: 21.42780, lines: ['2', '4', '5', '15', '22', '60'] },
  { id: 'citymall', name: 'Сити Мол (Карпош)', direction: 'Партизанска', latitude: 42.00420, longitude: 21.39120, lines: ['2', '4', '5', '15', '22'] },
  { id: 'biser', name: 'Аеродром Бисер', direction: 'Јане Сандански', latitude: 41.98420, longitude: 21.46450, lines: ['5', '7', '15'] },
  { id: 'gjorce', name: 'Ѓорче Петров Пошта', direction: 'Ѓорче Петров', latitude: 42.00760, longitude: 21.35330, lines: ['2', '4', '5', '22'] },
  { id: 'zelen-pazar', name: 'Зелен Пазар', direction: 'кон Југодрво / Кисела Вода', latitude: 41.99185, longitude: 21.43415, lines: ['4', '24', '41'] },
  { id: 'bit-pazar', name: 'Бит Пазар', direction: 'кон Чаир / Бутел', latitude: 42.00310, longitude: 21.44020, lines: ['8', '9', '16', '19', '57'] }
];

sql += '\n-- 4. SEED KEY JSP STOPS\n';
jspStops.forEach(s => {
  sql += `INSERT INTO public.transit_stops (id, name, direction, latitude, longitude, lines)
VALUES (${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.direction)}, ${s.latitude}, ${s.longitude}, ${escapeJson(s.lines)})
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  direction = EXCLUDED.direction,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  lines = EXCLUDED.lines;
`;
});

fs.writeFileSync('supabase/create_and_seed_transit.sql', sql, 'utf8');
console.log('Successfully generated supabase/create_and_seed_transit.sql! Total size:', sql.length);
