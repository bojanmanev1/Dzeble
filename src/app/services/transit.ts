import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { ALL_JSP_LINES, JspLine, JspDirectionSchedule } from './transit-lines.data';

export { JspLine, JspDirectionSchedule };



export interface JspStop {
  id: string;
  name: string;
  direction: string;
  latitude: number;
  longitude: number;
  lines: string[];
  distanceKm?: number;
}


export interface TrainStopSchedule {
  station: string;
  time: string;
}

export interface TrainRoute {
  id: string;
  trainNumber: string;
  routeName: string;
  fromCity: string;
  toCity: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: TrainStopSchedule[];
  runs: string;
  type: 'брз' | 'патнички';
}

@Injectable({
  providedIn: 'root'
})
export class TransitService {
  private supabaseService = inject(SupabaseService);
  private cacheKeyJsp = 'cached_jsp_lines';
  private cacheKeyStops = 'cached_jsp_stops';

  // --- 1. JSP SKOPJE ALL OFFICIAL LINES (110 lines from skopjebus.mk) ---
  private jspLines: JspLine[] = ALL_JSP_LINES.map(l => ({
    ...l,
    number: String(l.number || '').replace(/\s+/g, '').trim()
  }));

  // --- 2. KEY SKOPJE BUS STOPS WITH GPS ---
  private jspStops: JspStop[] = [
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

  // --- 3. MACEDONIAN RAILWAYS TIMETABLE (ЖРСМ ТРАНСПОРТ) ---
  private trainRoutes: TrainRoute[] = [
    {
      id: 'train-641',
      trainNumber: 'Воз 641',
      routeName: 'Скопје – Битола',
      fromCity: 'Скопје',
      toCity: 'Битола',
      departureTime: '07:06',
      arrivalTime: '10:31',
      duration: '3ч 25м',
      type: 'патнички',
      runs: 'Секој ден',
      stops: [
        { station: 'Скопје', time: '07:06' },
        { station: 'Лисиче', time: '07:14' },
        { station: 'Драчево', time: '07:20' },
        { station: 'Зелениково', time: '07:35' },
        { station: 'Велес', time: '08:01' },
        { station: 'Богомила', time: '08:50' },
        { station: 'Прилеп', time: '09:47' },
        { station: 'Бакарно Гумно', time: '10:08' },
        { station: 'Битола', time: '10:31' }
      ]
    },
    {
      id: 'train-643',
      trainNumber: 'Воз 643',
      routeName: 'Скопје – Битола',
      fromCity: 'Скопје',
      toCity: 'Битола',
      departureTime: '14:30',
      arrivalTime: '17:56',
      duration: '3ч 26м',
      type: 'патнички',
      runs: 'Секој ден',
      stops: [
        { station: 'Скопје', time: '14:30' },
        { station: 'Драчево', time: '14:44' },
        { station: 'Велес', time: '15:25' },
        { station: 'Чашка', time: '15:47' },
        { station: 'Богомила', time: '16:15' },
        { station: 'Прилеп', time: '17:12' },
        { station: 'Битола', time: '17:56' }
      ]
    },
    {
      id: 'train-645',
      trainNumber: 'Воз 645',
      routeName: 'Скопје – Битола',
      fromCity: 'Скопје',
      toCity: 'Битола',
      departureTime: '20:05',
      arrivalTime: '23:29',
      duration: '3ч 24м',
      type: 'патнички',
      runs: 'Секој ден',
      stops: [
        { station: 'Скопје', time: '20:05' },
        { station: 'Велес', time: '21:00' },
        { station: 'Богомила', time: '21:49' },
        { station: 'Прилеп', time: '22:45' },
        { station: 'Битола', time: '23:29' }
      ]
    },
    {
      id: 'train-640',
      trainNumber: 'Воз 640',
      routeName: 'Битола – Скопје',
      fromCity: 'Битола',
      toCity: 'Скопје',
      departureTime: '03:15',
      arrivalTime: '06:40',
      duration: '3ч 25м',
      type: 'патнички',
      runs: 'Секој ден',
      stops: [
        { station: 'Битола', time: '03:15' },
        { station: 'Прилеп', time: '04:00' },
        { station: 'Богомила', time: '04:56' },
        { station: 'Велес', time: '05:46' },
        { station: 'Драчево', time: '06:26' },
        { station: 'Скопје', time: '06:40' }
      ]
    },
    {
      id: 'train-642',
      trainNumber: 'Воз 642',
      routeName: 'Битола – Скопје',
      fromCity: 'Битола',
      toCity: 'Скопје',
      departureTime: '12:47',
      arrivalTime: '16:13',
      duration: '3ч 26м',
      type: 'патнички',
      runs: 'Секој ден',
      stops: [
        { station: 'Битола', time: '12:47' },
        { station: 'Прилеп', time: '13:32' },
        { station: 'Богомила', time: '14:28' },
        { station: 'Велес', time: '15:18' },
        { station: 'Скопје', time: '16:13' }
      ]
    },
    {
      id: 'train-644',
      trainNumber: 'Воз 644',
      routeName: 'Битола – Скопје',
      fromCity: 'Битола',
      toCity: 'Скопје',
      departureTime: '18:25',
      arrivalTime: '21:50',
      duration: '3ч 25м',
      type: 'патнички',
      runs: 'Секој ден',
      stops: [
        { station: 'Битола', time: '18:25' },
        { station: 'Прилеп', time: '19:10' },
        { station: 'Богомила', time: '20:06' },
        { station: 'Велес', time: '20:56' },
        { station: 'Скопје', time: '21:50' }
      ]
    },
    {
      id: 'train-611',
      trainNumber: 'Воз 611',
      routeName: 'Скопје – Гевгелија',
      fromCity: 'Скопје',
      toCity: 'Гевгелија',
      departureTime: '06:20',
      arrivalTime: '08:59',
      duration: '2ч 39м',
      type: 'брз',
      runs: 'Секој ден',
      stops: [
        { station: 'Скопје', time: '06:20' },
        { station: 'Велес', time: '07:20' },
        { station: 'Градско', time: '07:41' },
        { station: 'Неготино', time: '07:56' },
        { station: 'Демир Капија', time: '08:14' },
        { station: 'Миравци', time: '08:37' },
        { station: 'Гевгелија', time: '08:59' }
      ]
    },
    {
      id: 'train-631',
      trainNumber: 'Воз 631',
      routeName: 'Скопје – Гевгелија',
      fromCity: 'Скопје',
      toCity: 'Гевгелија',
      departureTime: '16:55',
      arrivalTime: '19:28',
      duration: '2ч 33м',
      type: 'брз',
      runs: 'Секој ден',
      stops: [
        { station: 'Скопје', time: '16:55' },
        { station: 'Велес', time: '17:46' },
        { station: 'Неготино', time: '18:25' },
        { station: 'Демир Капија', time: '18:43' },
        { station: 'Миравци', time: '19:06' },
        { station: 'Гевгелија', time: '19:28' }
      ]
    },
    {
      id: 'train-630',
      trainNumber: 'Воз 630',
      routeName: 'Гевгелија – Скопје',
      fromCity: 'Гевгелија',
      toCity: 'Скопје',
      departureTime: '04:30',
      arrivalTime: '07:07',
      duration: '2ч 37м',
      type: 'брз',
      runs: 'Секој ден',
      stops: [
        { station: 'Гевгелија', time: '04:30' },
        { station: 'Миравци', time: '04:52' },
        { station: 'Демир Капија', time: '05:14' },
        { station: 'Неготино', time: '05:32' },
        { station: 'Велес', time: '06:12' },
        { station: 'Скопје', time: '07:07' }
      ]
    },
    {
      id: 'train-632',
      trainNumber: 'Воз 632',
      routeName: 'Гевгелија – Скопје',
      fromCity: 'Гевгелија',
      toCity: 'Скопје',
      departureTime: '17:02',
      arrivalTime: '19:40',
      duration: '2ч 38м',
      type: 'брз',
      runs: 'Секој ден',
      stops: [
        { station: 'Гевгелија', time: '17:02' },
        { station: 'Миравци', time: '17:24' },
        { station: 'Демир Капија', time: '17:46' },
        { station: 'Неготино', time: '18:04' },
        { station: 'Велес', time: '18:44' },
        { station: 'Скопје', time: '19:40' }
      ]
    },
    {
      id: 'train-local-sk-veles',
      trainNumber: 'Воз 2081',
      routeName: 'Скопје – Велес (Локален)',
      fromCity: 'Скопје',
      toCity: 'Велес',
      departureTime: '22:40',
      arrivalTime: '23:35',
      duration: '55м',
      type: 'патнички',
      runs: 'Понеделник – Петок',
      stops: [
        { station: 'Скопје', time: '22:40' },
        { station: 'Лисиче', time: '22:48' },
        { station: 'Драчево', time: '22:55' },
        { station: 'Зелениково', time: '23:10' },
        { station: 'Велес', time: '23:35' }
      ]
    },
    {
      id: 'train-kumanovo',
      trainNumber: 'Воз 653',
      routeName: 'Скопје – Куманово / Табановце',
      fromCity: 'Скопје',
      toCity: 'Табановце',
      departureTime: '16:20',
      arrivalTime: '17:05',
      duration: '45м',
      type: 'патнички',
      runs: 'Секој ден',
      stops: [
        { station: 'Скопје', time: '16:20' },
        { station: 'Скопје Север', time: '16:29' },
        { station: 'Илинден', time: '16:41' },
        { station: 'Куманово', time: '16:55' },
        { station: 'Табановце', time: '17:05' }
      ]
    }
  ];

  constructor() {
    this.initFromLocalStorage();
    this.fetchTransitDataFromSupabase();
  }

  private initFromLocalStorage(): void {
    try {
      const cached = localStorage.getItem(this.cacheKeyJsp);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.jspLines = parsed.map((l: any) => ({
            ...l,
            number: String(l.number || '').replace(/\s+/g, '').trim()
          }));
        }
      }
      const cachedStops = localStorage.getItem(this.cacheKeyStops);
      if (cachedStops) {
        const parsedStops = JSON.parse(cachedStops);
        if (Array.isArray(parsedStops) && parsedStops.length > 0) {
          this.jspStops = parsedStops;
        }
      }
    } catch {}
  }

  private inFlightFetch: Promise<void> | null = null;

  public async fetchTransitDataFromSupabase(): Promise<void> {
    if (this.inFlightFetch) {
      return this.inFlightFetch;
    }
    this.inFlightFetch = this._doFetchTransitData();
    try {
      await this.inFlightFetch;
    } finally {
      this.inFlightFetch = null;
    }
  }

  private async _doFetchTransitData(): Promise<void> {
    try {
      const [linesRes, stopsRes, trainRes] = await Promise.all([
        this.supabaseService.supabase.from('transit_lines').select('*'),
        this.supabaseService.supabase.from('transit_stops').select('*'),
        this.supabaseService.supabase.from('train_routes').select('*')
      ]);

      if (linesRes.error) {
        if (linesRes.error.code === 'PGRST205') {
          console.info('TransitService: transit_lines table not found in Supabase schema cache yet. Using preloaded offline data.');
        } else {
          console.warn('TransitService: Error querying transit_lines:', linesRes.error.message);
        }
      } else if (linesRes.data && linesRes.data.length > 0) {
        this.jspLines = linesRes.data.map((row: any) => ({
          id: row.id,
          number: String(row.number || '').replace(/\s+/g, '').trim(),
          title: row.title,
          type: row.type || 'city',
          badgeColor: row.badge_color || row.badgeColor || '#10b981',
          route: row.route,
          frequency: row.frequency,
          firstDeparture: row.first_departure || row.firstDeparture,
          lastDeparture: row.last_departure || row.lastDeparture,
          stops: Array.isArray(row.stops) ? row.stops : (typeof row.stops === 'string' ? JSON.parse(row.stops) : []),
          departuresWorkday: Array.isArray(row.departures_workday) ? row.departures_workday : (row.departuresWorkday || []),
          departuresWeekend: Array.isArray(row.departures_weekend) ? row.departures_weekend : (row.departuresWeekend || []),
          directionA: row.direction_a || row.directionA || { title: '', origin: '', destination: '', stops: [], departuresWorkday: [], departuresSaturday: [], departuresSunday: [] },
          directionB: row.direction_b || row.directionB || { title: '', origin: '', destination: '', stops: [], departuresWorkday: [], departuresSaturday: [], departuresSunday: [] },
        }));
        try {
          localStorage.setItem(this.cacheKeyJsp, JSON.stringify(this.jspLines));
        } catch {}
      }

      if (stopsRes.error) {
        if (stopsRes.error.code === 'PGRST205') {
          console.info('TransitService: transit_stops table not found in Supabase schema cache yet. Using preloaded offline stops.');
        } else {
          console.warn('TransitService: Error querying transit_stops:', stopsRes.error.message);
        }
      } else if (stopsRes.data && stopsRes.data.length > 0) {
        this.jspStops = stopsRes.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          direction: s.direction,
          latitude: s.latitude,
          longitude: s.longitude,
          lines: Array.isArray(s.lines) ? s.lines : (typeof s.lines === 'string' ? JSON.parse(s.lines) : [])
        }));
        try {
          localStorage.setItem(this.cacheKeyStops, JSON.stringify(this.jspStops));
        } catch {}
      }

      if (trainRes.error) {
        if (trainRes.error.code === 'PGRST205') {
          console.info('TransitService: train_routes table not found in Supabase schema cache yet. Using preloaded offline train data.');
        } else {
          console.warn('TransitService: Error querying train_routes:', trainRes.error.message);
        }
      } else if (trainRes.data && trainRes.data.length > 0) {
        this.trainRoutes = trainRes.data.map((r: any) => ({
          id: r.id,
          trainNumber: r.train_number || r.trainNumber,
          routeName: r.route_name || r.routeName,
          fromCity: r.from_city || r.fromCity,
          toCity: r.to_city || r.toCity,
          departureTime: r.departure_time || r.departureTime,
          arrivalTime: r.arrival_time || r.arrivalTime,
          duration: r.duration,
          stops: Array.isArray(r.stops) ? r.stops : (typeof r.stops === 'string' ? JSON.parse(r.stops) : []),
          runs: r.runs || 'Секој ден',
          type: r.type || 'патнички'
        }));
      }
    } catch (err) {
      console.warn('TransitService: Network or fetch error:', err);
    }
  }

  // --- PUBLIC JSP METHODS ---
  public getJspLines(query?: string, type?: 'all' | 'city' | 'suburban'): JspLine[] {
    let result = [...this.jspLines];
    if (type && type !== 'all') {
      result = result.filter(l => l.type === type);
    }
    if (query && query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      const qClean = q.replace(/\s+/g, '');
      result = result.filter(l => {
        const numLower = l.number.toLowerCase();
        const numClean = numLower.replace(/\s+/g, '');
        return (
          numLower.includes(q) ||
          numClean.includes(qClean) ||
          numClean.replace(/п$/i, '').includes(qClean) ||
          l.title.toLowerCase().includes(q) ||
          l.title.toLowerCase().replace(/\s+/g, '').includes(qClean) ||
          l.route.toLowerCase().includes(q) ||
          l.directionA.origin.toLowerCase().includes(q) ||
          l.directionA.destination.toLowerCase().includes(q) ||
          l.directionB.origin.toLowerCase().includes(q) ||
          l.directionB.destination.toLowerCase().includes(q) ||
          l.stops.some(s => s.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }

  public getJspLineById(id: string): JspLine | undefined {
    if (!id) return undefined;
    const norm = id.trim().toLowerCase().replace(/\s+/g, '');
    return this.jspLines.find(l => {
      const lId = l.id.toLowerCase().replace(/\s+/g, '');
      const lNum = l.number.toLowerCase().replace(/\s+/g, '');
      return (
        lId === norm || 
        lNum === norm ||
        lNum === norm + 'п' ||
        lNum.replace(/п$/i, '') === norm
      );
    });
  }

  public getNearestJspStops(lat: number, lon: number, limit: number = 5): JspStop[] {
    const list = this.jspStops.map(s => ({
      ...s,
      distanceKm: this.calculateDistanceKm(lat, lon, s.latitude, s.longitude)
    }));
    list.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
    return list.slice(0, limit);
  }

  public getAllJspStops(): JspStop[] {
    return [...this.jspStops];
  }

  public getJspLineSchedule(line: JspLine, direction: 'A' | 'B' = 'A'): JspDirectionSchedule {
    return direction === 'B' ? line.directionB : line.directionA;
  }

  public getNextDeparture(
    line: JspLine, 
    direction: 'A' | 'B' = 'A',
    dayType?: 'workday' | 'saturday' | 'sunday'
  ): { next: string; inMinutes: number } | null {
    const sched = this.getJspLineSchedule(line, direction);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let targetDay = dayType;
    if (!targetDay) {
      const day = now.getDay();
      if (day === 6) targetDay = 'saturday';
      else if (day === 0) targetDay = 'sunday';
      else targetDay = 'workday';
    }

    let timetable: string[];
    if (targetDay === 'saturday') {
      timetable = sched.departuresSaturday?.length ? sched.departuresSaturday : (line.departuresWeekend || sched.departuresWorkday);
    } else if (targetDay === 'sunday') {
      timetable = sched.departuresSunday?.length ? sched.departuresSunday : (line.departuresWeekend || sched.departuresWorkday);
    } else {
      timetable = sched.departuresWorkday?.length ? sched.departuresWorkday : line.departuresWorkday;
    }

    for (const dep of timetable) {
      const [h, m] = dep.split(':').map(Number);
      const depMinutes = h * 60 + m;
      if (depMinutes >= currentMinutes) {
        return {
          next: dep,
          inMinutes: depMinutes - currentMinutes
        };
      }
    }

    // If past all departures today, return first departure tomorrow
    if (timetable.length > 0) {
      const [h, m] = timetable[0].split(':').map(Number);
      const depMinutes = h * 60 + m + (24 * 60);
      return {
        next: timetable[0],
        inMinutes: depMinutes - currentMinutes
      };
    }

    return null;
  }


  // --- PUBLIC TRAIN METHODS ---
  public getTrainRoutes(fromCity?: string, toCity?: string, query?: string): TrainRoute[] {
    let list = [...this.trainRoutes];
    if (fromCity && fromCity.trim().length > 0) {
      const f = fromCity.trim().toLowerCase();
      list = list.filter(r => r.fromCity.toLowerCase().includes(f));
    }
    if (toCity && toCity.trim().length > 0) {
      const t = toCity.trim().toLowerCase();
      list = list.filter(r => r.toCity.toLowerCase().includes(t));
    }
    if (query && query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      list = list.filter(r => 
        r.trainNumber.toLowerCase().includes(q) ||
        r.routeName.toLowerCase().includes(q) ||
        r.stops.some(s => s.station.toLowerCase().includes(q))
      );
    }
    return list;
  }

  public getNextTrainDeparture(): { route: TrainRoute; inMinutes: number } | null {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let bestMatch: { route: TrainRoute; inMinutes: number } | null = null;
    let minDiff = 9999;

    for (const route of this.trainRoutes) {
      const [h, m] = route.departureTime.split(':').map(Number);
      const depMinutes = h * 60 + m;
      if (depMinutes >= currentMinutes) {
        const diff = depMinutes - currentMinutes;
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = { route, inMinutes: diff };
        }
      }
    }
    return bestMatch;
  }

  // --- DISTANCE UTILS ---
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public formatDistance(km?: number): string {
    if (km == null || isNaN(km)) return '';
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)} km`;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
