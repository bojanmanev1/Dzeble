import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface StockTicker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
}

@Injectable({
  providedIn: 'root',
})
export class StockService {
  private ws: WebSocket | null = null;
  private pollingInterval: any = null;
  private stockDataSubject = new BehaviorSubject<Map<string, StockTicker>>(new Map());
  public stockData$: Observable<Map<string, StockTicker>> = this.stockDataSubject.asObservable();

  private apiKey = 'da402nhr01qual4s09agda402nhr01qual4s09b0';
  public watchedStocks: string[] = JSON.parse(
    localStorage.getItem('user_watched_stocks') || '["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL"]'
  );

  constructor(private zone: NgZone) {}

  public connect(): void {
    // 1. Single initial fetch on app load
    this.fetchAllQuotes();

    // 2. Open WebSocket for live trades
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

    this.ws.onopen = () => {
      // Clear HTTP polling if WS connects successfully
      this.stopPolling();

      this.watchedStocks.forEach((symbol) => {
        this.ws?.send(JSON.stringify({ type: 'subscribe', symbol: symbol }));
      });
    };

    this.ws.onmessage = (event) => {
      this.zone.run(() => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'trade' && payload.data) {
            const currentMap = new Map(this.stockDataSubject.value);

            payload.data.forEach((trade: any) => {
              const symbol = trade.s;
              const currentPrice = trade.p;
              const existing = currentMap.get(symbol);

              currentMap.set(symbol, {
                symbol: symbol,
                price: currentPrice,
                change24h: existing ? existing.change24h : 0,
                high24h: existing ? Math.max(existing.high24h, currentPrice) : currentPrice,
                low24h: existing ? Math.min(existing.low24h, currentPrice) : currentPrice,
              });
            });

            this.stockDataSubject.next(currentMap);
          }
        } catch (e) {
          console.error('WebSocket parsing error:', e);
        }
      });
    };

    // 3. Fallback to 60s polling only if WS closes (e.g., outside market hours or offline)
    this.ws.onclose = () => {
      this.startFallbackPolling();
      setTimeout(() => this.connect(), 10000);
    };

    this.ws.onerror = () => {
      this.startFallbackPolling();
    };
  }

  private startFallbackPolling() {
    if (this.pollingInterval) return;
    // Poll once every 60 seconds (well within free 60 req/min limit)
    this.pollingInterval = setInterval(() => {
      this.fetchAllQuotes();
    }, 60000);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  public async fetchAllQuotes(): Promise<void> {
    const currentMap = new Map(this.stockDataSubject.value);

    for (const symbol of this.watchedStocks) {
      try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.apiKey}`);
        if (res.status === 429) {
          console.warn('Finnhub rate limit reached (429).');
          break;
        }

        const data = await res.json();
        if (data && data.c) {
          currentMap.set(symbol, {
            symbol: symbol,
            price: data.c,
            change24h: data.dp ? parseFloat(data.dp.toFixed(2)) : 0,
            high24h: data.h || data.c,
            low24h: data.l || data.c,
          });
        }
      } catch (err) {
        console.error(`Quote update failed for ${symbol}`, err);
      }
    }

    this.zone.run(() => {
      this.stockDataSubject.next(currentMap);
    });
  }

  public async addStockSymbol(symbol: string): Promise<boolean> {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol || this.watchedStocks.includes(cleanSymbol)) return false;

    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${this.apiKey}`);
      const data = await res.json();

      if (data && data.c && data.c > 0) {
        this.watchedStocks.push(cleanSymbol);
        localStorage.setItem('user_watched_stocks', JSON.stringify(this.watchedStocks));

        const currentMap = new Map(this.stockDataSubject.value);
        currentMap.set(cleanSymbol, {
          symbol: cleanSymbol,
          price: data.c,
          change24h: data.dp ? parseFloat(data.dp.toFixed(2)) : 0,
          high24h: data.h || data.c,
          low24h: data.l || data.c,
        });

        this.zone.run(() => {
          this.stockDataSubject.next(currentMap);
        });

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'subscribe', symbol: cleanSymbol }));
        }

        return true;
      }
    } catch (e) {
      console.error('Symbol lookup failed:', e);
    }
    return false;
  }

  public removeStockSymbol(symbol: string): void {
    this.watchedStocks = this.watchedStocks.filter((s) => s !== symbol);
    localStorage.setItem('user_watched_stocks', JSON.stringify(this.watchedStocks));

    const currentMap = new Map(this.stockDataSubject.value);
    currentMap.delete(symbol);
    this.stockDataSubject.next(currentMap);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol: symbol }));
    }
  }

  public disconnect(): void {
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}


// da402nhr01qual4s09agda402nhr01qual4s09b0