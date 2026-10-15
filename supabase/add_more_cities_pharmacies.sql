INSERT INTO duty_pharmacies (name, chain, city, city_slug, municipality, address, phone, latitude, longitude, is_24_7, working_hours, google_maps_url)
VALUES
  ('Зегин - Општа Болница Велес (Дежурна)', 'zegin', 'Велес', 'veles', 'Центар', 'ул. Благој Ѓорев бб', '+38943231100', 41.7153, 21.7725, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.7153,21.7725'),
  ('Еурофарм - Центар Велес', 'eurofarm', 'Велес', 'veles', 'Центар', 'ул. 8 Септември бр. 20', '+38943222300', 41.7170, 21.7760, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.7170,21.7760'),
  ('Зегин - Клиничка Болница Штип (Дежурна)', 'zegin', 'Штип', 'stip', 'Центар', 'ул. Љубен Иванов бб', '+38932391200', 41.7455, 22.1930, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.7455,22.1930'),
  ('Еурофарм - Центар Штип', 'eurofarm', 'Штип', 'stip', 'Центар', 'ул. Маршал Тито бр. 40', '+38932388100', 41.7420, 22.1910, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.7420,22.1910'),
  ('Зегин - Општа Болница Кавадарци (Дежурна)', 'zegin', 'Кавадарци', 'kavadarci', 'Центар', 'ул. Илинденска бб', '+38943412500', 41.4330, 22.0110, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.4330,22.0110'),
  ('Зегин - Општа Болница Кочани (Дежурна)', 'zegin', 'Кочани', 'kocani', 'Центар', 'ул. Димитар Влахов бб', '+38933271400', 41.9160, 22.4120, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.9160,22.4120'),
  ('Зегин - Општа Болница Гевгелија (Дежурна)', 'zegin', 'Гевгелија', 'gevgelija', 'Центар', 'ул. Димитар Влахов бб', '+38934212600', 41.1430, 22.5020, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.1430,22.5020')
ON CONFLICT (name, city) DO UPDATE SET
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  updated_at = now();
