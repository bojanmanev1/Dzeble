-- Update Skopje (Strict 24/7 round the clock):
UPDATE duty_pharmacies SET working_hours = '24/7 (00:00 - 24:00)', is_24_7 = true WHERE city = 'Скопје';

-- Update Bitola:
UPDATE duty_pharmacies SET name = 'ПЗУ Аптека Роса Вита (спроти Брза Помош)', working_hours = '07:30 - 24:00', is_24_7 = false WHERE city = 'Битола' AND name LIKE '%Роса Вита%';
UPDATE duty_pharmacies SET name = 'Зегин - Медицински Центар Битола', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Битола' AND name LIKE '%Медицински%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Широк Сокак Битола', working_hours = '08:00 - 22:00', is_24_7 = false WHERE city = 'Битола' AND name LIKE '%Широк%';

-- Update Kumanovo:
UPDATE duty_pharmacies SET name = 'Зегин - Плоштад Куманово', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Куманово' AND name LIKE '%Плоштад%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Општа Болница Куманово', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Куманово' AND name LIKE '%Болница%';

-- Update Prilep:
UPDATE duty_pharmacies SET name = 'Зегин - Градска Болница Прилеп', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Прилеп' AND name LIKE '%Болница%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Центар Прилеп', working_hours = '08:00 - 21:00', is_24_7 = false WHERE city = 'Прилеп' AND name LIKE '%Центар%';

-- Update Tetovo:
UPDATE duty_pharmacies SET name = 'Зегин - Клиничка Болница Тетово', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Тетово' AND name LIKE '%Болница%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Плоштад Илирија Тетово', working_hours = '08:00 - 22:00', is_24_7 = false WHERE city = 'Тетово' AND name LIKE '%Илирија%';

-- Update Ohrid:
UPDATE duty_pharmacies SET name = 'Зегин - Булевар Туристичка Охрид', working_hours = '08:00 - 22:00', is_24_7 = false WHERE city = 'Охрид' AND name LIKE '%Туристичка%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Стара Чаршија Охрид', working_hours = '08:00 - 22:00', is_24_7 = false WHERE city = 'Охрид' AND name LIKE '%Чаршија%';

-- Update Veles:
UPDATE duty_pharmacies SET name = 'Зегин - Општа Болница Велес', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Велес' AND name LIKE '%Болница%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Центар Велес', working_hours = '08:00 - 21:00', is_24_7 = false WHERE city = 'Велес' AND name LIKE '%Центар%';

-- Update Stip:
UPDATE duty_pharmacies SET name = 'Зегин - Клиничка Болница Штип', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Штип' AND name LIKE '%Болница%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Центар Штип', working_hours = '08:00 - 21:00', is_24_7 = false WHERE city = 'Штип' AND name LIKE '%Центар%';

-- Update Strumica:
UPDATE duty_pharmacies SET name = 'Зегин - Ленинова Струмица', working_hours = '08:00 - 22:00', is_24_7 = false WHERE city = 'Струмица' AND name LIKE '%Ленинова%';
UPDATE duty_pharmacies SET name = 'Еурофарм - Општа Болница Струмица', working_hours = '07:30 - 21:00', is_24_7 = false WHERE city = 'Струмица' AND name LIKE '%Болница%';

-- Update Kavadarci, Gostivar, Kocani, Gevgelija:
UPDATE duty_pharmacies SET name = 'Зегин - Општа Болница Кавадарци', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Кавадарци';
UPDATE duty_pharmacies SET name = 'Зегин - Центар Гостивар', working_hours = '08:00 - 22:00', is_24_7 = false WHERE city = 'Гостивар';
UPDATE duty_pharmacies SET name = 'Зегин - Општа Болница Кочани', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Кочани';
UPDATE duty_pharmacies SET name = 'Зегин - Општа Болница Гевгелија', working_hours = '07:30 - 22:00', is_24_7 = false WHERE city = 'Гевгелија';
