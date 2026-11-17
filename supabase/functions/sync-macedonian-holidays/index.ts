import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Meeus Julian algorithm for Orthodox Easter converted to Gregorian calendar (+13 days for 1900-2099)
function getOrthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julianDate = new Date(Date.UTC(year, month - 1, day));
  julianDate.setUTCDate(julianDate.getUTCDate() + 13);
  return julianDate;
}

// Computus algorithm for Western / Catholic Easter
function getCatholicEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Official statutory Islamic (Ramadan Bajram, Kurban Bajram) & Jewish (Yom Kippur) calendar
const KNOWN_RELIGIOUS_DATES: Record<number, { ramadan: string; kurban: string; yomKippur?: string }> = {
  2026: { ramadan: "2026-03-20", kurban: "2026-05-27", yomKippur: "2026-09-21" },
  2027: { ramadan: "2027-03-10", kurban: "2027-05-17", yomKippur: "2027-10-11" },
  2028: { ramadan: "2028-02-27", kurban: "2028-05-05", yomKippur: "2028-09-30" },
  2029: { ramadan: "2029-02-15", kurban: "2029-04-24", yomKippur: "2029-09-19" },
  2030: { ramadan: "2030-02-05", kurban: "2030-04-14", yomKippur: "2030-10-07" },
  2031: { ramadan: "2031-01-25", kurban: "2031-04-03", yomKippur: "2031-09-27" },
  2032: { ramadan: "2032-01-14", kurban: "2032-03-22", yomKippur: "2032-09-15" },
  2033: { ramadan: "2033-01-03", kurban: "2033-03-12", yomKippur: "2033-10-04" },
  2034: { ramadan: "2034-12-13", kurban: "2034-03-01", yomKippur: "2034-09-23" },
  2035: { ramadan: "2035-12-02", kurban: "2035-02-18", yomKippur: "2035-10-13" }
};

interface HolidayDefinition {
  holiday_date: string;
  title_mk: string;
  title_en: string;
  title_al: string;
  is_national: boolean;
  community_type: string;
  target_group_mk: string;
  target_group_en: string;
  target_group_al: string;
  color_code: string;
}

export function generateMacedonianHolidaysForYear(year: number): HolidayDefinition[] {
  const result: HolidayDefinition[] = [];

  // 1. All Fixed Annual Holidays
  const fixedAnnual = [
    { m: "01", d: "01", mk: "Нова Година", en: "New Year's Day", al: "Viti i Ri", nat: true, comm: "all", col: "#9f1239" },
    { m: "01", d: "06", mk: "Бадник", en: "Christmas Eve (Orthodox)", al: "Buzmi", nat: false, comm: "orthodox", col: "#d97706", tMk: "За граѓаните од православна вероисповед", tEn: "For Orthodox Christians", tAl: "Për besimtarët ortodoksë" },
    { m: "01", d: "07", mk: "Божиќ (Прв ден)", en: "Christmas Day (Orthodox)", al: "Krishtlindjet", nat: true, comm: "all", col: "#9f1239" },
    { m: "01", d: "19", mk: "Богојавление (Водици)", en: "Epiphany (Vodici)", al: "Uji i Bekuar", nat: false, comm: "orthodox", col: "#d97706", tMk: "За граѓаните од православна вероисповед", tEn: "For Orthodox Christians", tAl: "Për besimtarët ortodoksë" },
    { m: "01", d: "27", mk: "Свети Сава", en: "Saint Sava Day", al: "Shën Sava", nat: false, comm: "serb", col: "#581c87", tMk: "За припадниците на српската заедница", tEn: "For the Serbian community", tAl: "Për pjesëtarët e komunitetit serb" },
    { m: "04", d: "08", mk: "Меѓународен ден на Ромите", en: "International Romani Day", al: "Dita Ndërkombëtare e Romëve", nat: false, comm: "roma", col: "#581c87", tMk: "За припадниците на ромската заедница", tEn: "For the Roma community", tAl: "Për pjesëtarët e komunitetit rom" },
    { m: "05", d: "01", mk: "Ден на Трудот", en: "Labor Day", al: "Dita e Punës", nat: true, comm: "all", col: "#9f1239" },
    { m: "05", d: "23", mk: "Национален ден на Власите", en: "National Vlach Day", al: "Dita Kombëtare e Vllehëve", nat: false, comm: "vlach", col: "#581c87", tMk: "За припадниците на влашката заедница", tEn: "For the Vlach community", tAl: "Për pjesëtarët e komunitetit vllah" },
    { m: "05", d: "24", mk: "Св. Кирил и Методиј", en: "St. Cyril and Methodius Day", al: "Shën Qirili dhe Metodi", nat: true, comm: "all", col: "#9f1239" },
    { m: "08", d: "02", mk: "Ден на Републиката (Илинден)", en: "Republic Day (Ilinden)", al: "Dita e Republikës", nat: true, comm: "all", col: "#9f1239" },
    { m: "08", d: "28", mk: "Успение на Пресвета Богородица", en: "Assumption of Mary", al: "Fjetja e Shën Mërisë", nat: false, comm: "orthodox", col: "#d97706", tMk: "За граѓаните од православна вероисповед", tEn: "For Orthodox Christians", tAl: "Për besimtarët ortodoksë" },
    { m: "09", d: "08", mk: "Ден на Независноста", en: "Independence Day", al: "Dita e Pavarësisë", nat: true, comm: "all", col: "#9f1239" },
    { m: "09", d: "28", mk: "Меѓународен ден на Бошњаците", en: "International Bosniaks Day", al: "Dita Ndërkombëtare e Boshnjakëve", nat: false, comm: "bosniak", col: "#581c87", tMk: "За припадниците на бошњачката заедница", tEn: "For the Bosniak community", tAl: "Për pjesëtarët e komunitetit boshnjak" },
    { m: "10", d: "11", mk: "Ден на Народното Востание", en: "Revolution Day", al: "Dita e Kryengritjes", nat: true, comm: "all", col: "#9f1239" },
    { m: "10", d: "23", mk: "Ден на Македонската Револуционерна Борба", en: "Day of Revolutionary Struggle", al: "Dita e Luftës Revolucionare", nat: true, comm: "all", col: "#9f1239" },
    { m: "11", d: "01", mk: "Празник на сите светци", en: "All Saints' Day", al: "Të Gjithë Shenjtorët", nat: false, comm: "catholic", col: "#1e40af", tMk: "За граѓаните од католичка вероисповед", tEn: "For Catholic citizens", tAl: "Për besimtarët katolikë" },
    { m: "11", d: "22", mk: "Ден на Албанската Азбука", en: "Albanian Alphabet Day", al: "Dita e Alfabetit Shqip", nat: false, comm: "albanian", col: "#581c87", tMk: "За припадниците на албанската заедница", tEn: "For the Albanian community", tAl: "Për pjesëtarët e komunitetit shqiptar" },
    { m: "12", d: "08", mk: "Св. Климент Охридски", en: "St. Clement of Ohrid Day", al: "Shën Klimenti i Ohrit", nat: true, comm: "all", col: "#9f1239" },
    { m: "12", d: "21", mk: "Ден на Настава на Турски Јазик", en: "Turkish Language Day", al: "Dita e Mësimit në Gjuhën Turke", nat: false, comm: "turkish", col: "#581c87", tMk: "За припадниците на турската заедница", tEn: "For the Turkish community", tAl: "Për pjesëtarët e komunitetit turk" },
    { m: "12", d: "25", mk: "Божиќ (Католички)", en: "Christmas Day (Catholic)", al: "Krishtlindjet Katolike", nat: false, comm: "catholic", col: "#1e40af", tMk: "За граѓаните од католичка вероисповед", tEn: "For Catholic citizens", tAl: "Për besimtarët katolikë" }
  ];

  for (const f of fixedAnnual) {
    const dStr = `${year}-${f.m}-${f.d}`;
    const dt = new Date(`${dStr}T00:00:00Z`);

    result.push({
      holiday_date: dStr,
      title_mk: f.mk,
      title_en: f.en,
      title_al: f.al,
      is_national: f.nat,
      community_type: f.comm,
      target_group_mk: f.tMk || "За сите граѓани",
      target_group_en: f.tEn || "For all citizens",
      target_group_al: f.tAl || "Për të gjithë qytetarët",
      color_code: f.col
    });

    // Law on Holidays (Article 4): If a national public holiday falls on Sunday, observed day is Monday
    if (f.nat && dt.getUTCDay() === 0) {
      const mon = new Date(dt);
      mon.setUTCDate(mon.getUTCDate() + 1);
      result.push({
        holiday_date: formatDateStr(mon),
        title_mk: `${f.mk} (Неработен ден)`,
        title_en: `${f.en} (Observed)`,
        title_al: `${f.al} (E hënë)`,
        is_national: true,
        community_type: "all",
        target_group_mk: "За сите граѓани",
        target_group_en: "For all citizens",
        target_group_al: "Për të gjithë qytetarët",
        color_code: "#9f1239"
      });
    }
  }

  // 2. Movable Orthodox Easter & Connected Holidays
  const oEaster = getOrthodoxEaster(year);
  const goodFri = new Date(oEaster); goodFri.setUTCDate(oEaster.getUTCDate() - 2);
  const easterMon = new Date(oEaster); easterMon.setUTCDate(oEaster.getUTCDate() + 1);
  const pentecostFri = new Date(oEaster); pentecostFri.setUTCDate(oEaster.getUTCDate() + 47);

  result.push({
    holiday_date: formatDateStr(goodFri),
    title_mk: "Велипеток",
    title_en: "Good Friday (Orthodox)",
    title_al: "E Premtja e Madhe",
    is_national: false,
    community_type: "orthodox",
    target_group_mk: "За граѓаните од православна вероисповед",
    target_group_en: "For Orthodox Christians",
    target_group_al: "Për besimtarët ortodoksë",
    color_code: "#d97706"
  });

  result.push({
    holiday_date: formatDateStr(easterMon),
    title_mk: "Велигден (Втор ден)",
    title_en: "Easter Monday (Orthodox)",
    title_al: "E Diela e Pashkëve",
    is_national: true,
    community_type: "all",
    target_group_mk: "За сите граѓани",
    target_group_en: "For all citizens",
    target_group_al: "Për të gjithë qytetarët",
    color_code: "#9f1239"
  });

  result.push({
    holiday_date: formatDateStr(pentecostFri),
    title_mk: "Духовден (Петок пред Духовден)",
    title_en: "Pentecost Friday",
    title_al: "E Premtja e Rrëshajëve",
    is_national: false,
    community_type: "orthodox",
    target_group_mk: "За граѓаните од православна вероисповед",
    target_group_en: "For Orthodox Christians",
    target_group_al: "Për besimtarët ortodoksë",
    color_code: "#d97706"
  });

  // 3. Movable Western / Catholic Easter Monday
  const cEaster = getCatholicEaster(year);
  const cEasterMon = new Date(cEaster); cEasterMon.setUTCDate(cEaster.getUTCDate() + 1);
  result.push({
    holiday_date: formatDateStr(cEasterMon),
    title_mk: "Велигден (Втор ден - Католички)",
    title_en: "Easter Monday (Catholic)",
    title_al: "Pashkët Katolike",
    is_national: false,
    community_type: "catholic",
    target_group_mk: "За граѓаните од католичка вероисповед",
    target_group_en: "For Catholic citizens",
    target_group_al: "Për besimtarët katolikë",
    color_code: "#1e40af"
  });

  // 4. Islamic (Ramadan Bajram, Kurban Bajram) & Jewish (Yom Kippur) Holidays
  const religious = KNOWN_RELIGIOUS_DATES[year];
  if (religious) {
    // Ramadan Bajram
    const ramDt = new Date(`${religious.ramadan}T00:00:00Z`);
    result.push({
      holiday_date: religious.ramadan,
      title_mk: "Рамазан Бајрам (Прв ден)",
      title_en: "Ramadan Bajram",
      title_al: "Fitër Bajrami",
      is_national: true,
      community_type: "all",
      target_group_mk: "За сите граѓани",
      target_group_en: "For all citizens",
      target_group_al: "Për të gjithë qytetarët",
      color_code: "#9f1239"
    });

    if (ramDt.getUTCDay() === 0) {
      const mon = new Date(ramDt); mon.setUTCDate(mon.getUTCDate() + 1);
      result.push({
        holiday_date: formatDateStr(mon),
        title_mk: "Рамазан Бајрам (Неработен ден)",
        title_en: "Ramadan Bajram (Observed)",
        title_al: "Fitër Bajrami (E hënë)",
        is_national: true,
        community_type: "all",
        target_group_mk: "За сите граѓани",
        target_group_en: "For all citizens",
        target_group_al: "Për të gjithë qytetarët",
        color_code: "#9f1239"
      });
    }

    // Kurban Bajram
    result.push({
      holiday_date: religious.kurban,
      title_mk: "Курбан Бајрам (Прв ден)",
      title_en: "Kurban Bajram",
      title_al: "Kurban Bajrami",
      is_national: false,
      community_type: "muslim",
      target_group_mk: "За граѓаните од муслиманска вероисповед",
      target_group_en: "For Muslim citizens",
      target_group_al: "Për besimtarët myslimanë",
      color_code: "#065f46"
    });

    // Yom Kippur
    if (religious.yomKippur) {
      result.push({
        holiday_date: religious.yomKippur,
        title_mk: "Јом Кипур",
        title_en: "Yom Kippur",
        title_al: "Jom Kipur",
        is_national: false,
        community_type: "jewish",
        target_group_mk: "За припадниците на еврејската заедница",
        target_group_en: "For the Jewish community",
        target_group_al: "Për pjesëtarët e komunitetit mehad",
        color_code: "#581c87"
      });
    }
  }

  // Deduplicate by holiday_date to respect unique constraint (macedonian_holidays_holiday_date_key)
  const byDate = new Map<string, HolidayDefinition>();
  for (const h of result) {
    if (!byDate.has(h.holiday_date)) {
      byDate.set(h.holiday_date, h);
    } else {
      const existing = byDate.get(h.holiday_date)!;
      // If the incoming holiday is national and existing is not, prioritize the national holiday
      if (h.is_national && !existing.is_national) {
        byDate.set(h.holiday_date, h);
      }
    }
  }

  const finalResult = Array.from(byDate.values());
  finalResult.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  return finalResult;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const yearsParam = url.searchParams.get("years"); // e.g. "2028,2029,2030"

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase service environment variables" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const currentYear = new Date().getFullYear();

    let targetYears: number[] = [];
    if (yearsParam) {
      targetYears = yearsParam.split(",").map(y => parseInt(y.trim(), 10)).filter(y => !isNaN(y));
    } else {
      // By default ensure current year, next year, and the next 2 years exist
      targetYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];
    }

    const report: Record<number, { inserted: number; existing: number; total: number }> = {};
    let totalInserted = 0;

    for (const year of targetYears) {
      const generated = generateMacedonianHolidaysForYear(year);

      // Check existing in DB for this year
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data: existingRecords, error: fetchErr } = await supabase
        .from("macedonian_holidays")
        .select("id, holiday_date, title_mk")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate);

      if (fetchErr) {
        console.error(`Error querying holidays for ${year}:`, fetchErr);
        continue;
      }

      const existingSet = new Set(
        (existingRecords || []).map((r: any) => `${r.holiday_date}_${r.title_mk}`)
      );

      const toInsert = generated.filter(
        h => !existingSet.has(`${h.holiday_date}_${h.title_mk}`)
      );

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from("macedonian_holidays")
          .insert(toInsert);

        if (insertErr) {
          console.error(`Error inserting holidays for ${year}:`, insertErr);
          (report as any)[year] = {
            inserted: 0,
            existing: existingRecords?.length || 0,
            total: generated.length,
            error: insertErr
          };
        } else {
          totalInserted += toInsert.length;
          report[year] = {
            inserted: toInsert.length,
            existing: existingRecords?.length || 0,
            total: generated.length
          };
        }
      } else {
        report[year] = {
          inserted: 0,
          existing: existingRecords?.length || 0,
          total: generated.length
        };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      report,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
