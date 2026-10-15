INSERT INTO duty_pharmacies (name, chain, city, city_slug, municipality, address, phone, latitude, longitude, is_24_7, working_hours, google_maps_url)
VALUES
  -- Скопје (Точно според dezurna.net)
  ('Zegin Bunjakovec', 'zegin', 'Скопје', 'skopje', 'Центар', 'Bulevar Partizanski odredi 25-1/35', '+38923298504', 41.9972, 21.4215, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.9972,21.4215'),
  ('Zegin Gradska', 'zegin', 'Скопје', 'skopje', 'Центар', '11-ti Oktomvri 15', '+38923112418', 41.9934, 21.4332, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.9934,21.4332'),
  ('Eurofarm Mirče Acev', 'eurofarm', 'Скопје', 'skopje', 'Центар', 'Mirče Acev 2', '+38923209696', 41.9942, 21.4348, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.9942,21.4348'),
  ('Eurofarm Taftalidže', 'eurofarm', 'Скопје', 'skopje', 'Карпош', 'Moskovska bb', '+38925514580', 42.0007, 21.4014, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=42.0007,21.4014'),
  
  -- Битола
  ('ПЗУ Аптека Роса Вита (Дежурна 24/7)', 'other', 'Битола', 'bitola', 'Центар', 'ул. Моша Пијаде бр. 11-13 (спроти Брза Помош)', '+38947223550', 41.0315, 21.3340, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.0315,21.3340'),
  ('Зегин - Медицински Центар Битола (24/7)', 'zegin', 'Битола', 'bitola', 'Центар', 'ул. Партизанска бб (Медицински Центар)', '+38947236410', 41.0340, 21.3280, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.0340,21.3280'),
  ('Еурофарм - Широк Сокак Битола', 'eurofarm', 'Битола', 'bitola', 'Центар', 'Широк Сокак бр. 45', '+38947203010', 41.0285, 21.3335, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.0285,21.3335'),

  -- Куманово
  ('Зегин - Плоштад Куманово (24/7)', 'zegin', 'Куманово', 'kumanovo', 'Центар', 'пл. Маршал Тито бр. 1', '+38931422555', 42.1352, 21.7180, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=42.1352,21.7180'),
  ('Еурофарм - Општа Болница Куманово', 'eurofarm', 'Куманово', 'kumanovo', 'Центар', 'ул. 11 Октомври бб (Болница)', '+38931411900', 42.1380, 21.7250, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=42.1380,21.7250'),

  -- Прилеп
  ('Зегин - Градска Болница Прилеп (24/7)', 'zegin', 'Прилеп', 'prilep', 'Центар', 'ул. Браќа Миладиновци бб', '+38948421310', 41.3440, 21.5540, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.3440,21.5540'),
  ('Еурофарм - Центар Прилеп', 'eurofarm', 'Прилеп', 'prilep', 'Центар', 'пл. Методија Андонов Ченто бб', '+38948412220', 41.3465, 21.5535, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.3465,21.5535'),

  -- Охрид
  ('Зегин - Туристичка Охрид (24/7)', 'zegin', 'Охрид', 'ohrid', 'Центар', 'бул. Туристичка бр. 42', '+38946260120', 41.1165, 20.8035, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.1165,20.8035'),
  ('Еурофарм - Стара Чаршија Охрид', 'eurofarm', 'Охрид', 'ohrid', 'Центар', 'ул. Св. Климент Охридски бр. 18', '+38946250330', 41.1130, 20.7980, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.1130,20.7980'),

  -- Тетово
  ('Зегин - Клиничка Болница Тетово (24/7)', 'zegin', 'Тетово', 'tetovo', 'Центар', 'ул. 29 Ноември бб', '+38944331500', 42.0080, 20.9710, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=42.0080,20.9710'),
  ('Еурофарм - Плоштад Илирија Тетово', 'eurofarm', 'Тетово', 'tetovo', 'Центар', 'пл. Илирија бб', '+38944350200', 42.0105, 20.9680, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=42.0105,20.9680'),

  -- Гостивар
  ('Зегин - Центар Гостивар (24/7)', 'zegin', 'Гостивар', 'gostivar', 'Центар', 'бул. Браќа Ѓиноски бр. 30', '+38942215400', 41.7960, 20.9080, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.7960,20.9080'),

  -- Струмица
  ('Зегин - Ленинова Струмица (24/7)', 'zegin', 'Струмица', 'strumica', 'Центар', 'ул. Ленинова бр. 15', '+38934345600', 41.4375, 22.6430, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.4375,22.6430'),
  ('Еурофарм - Општа Болница Струмица', 'eurofarm', 'Струмица', 'strumica', 'Центар', 'ул. Младинска бб', '+38934321100', 41.4410, 22.6405, true, '24/7', 'https://www.google.com/maps/dir/?api=1&destination=41.4410,22.6405')
ON CONFLICT (name, city) DO UPDATE SET
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  is_24_7 = EXCLUDED.is_24_7,
  google_maps_url = EXCLUDED.google_maps_url,
  updated_at = now();
