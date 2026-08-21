import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CryptoTicker {
  symbol: string;
  pair: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
}

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private ws: WebSocket | null = null;
  private cryptoDataSubject = new BehaviorSubject<Map<string, CryptoTicker>>(new Map());
  public cryptoData$: Observable<Map<string, CryptoTicker>> = this.cryptoDataSubject.asObservable();

  // Load user pairs or fallback to defaults
  public watchedPairs: string[] = JSON.parse(
    localStorage.getItem('user_watched_crypto') || 
    '["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT"]'
  );

  constructor(private zone: NgZone) {}

  public connect(): void {
    // Initial REST seed to populate list instantly
    this.fetchInitialPrices();

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const streamUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
    this.ws = new WebSocket(streamUrl);

    this.ws.onmessage = (event) => {
      this.zone.run(() => {
        try {
          const rawTickers = JSON.parse(event.data);
          if (!Array.isArray(rawTickers)) return;

          const currentMap = new Map(this.cryptoDataSubject.value);

          rawTickers.forEach((ticker: any) => {
            const symbol = ticker.s; // e.g. BTCUSDT
            if (this.watchedPairs.includes(symbol)) {
              const openPrice = parseFloat(ticker.o);
              const closePrice = parseFloat(ticker.c);
              const change24h = ((closePrice - openPrice) / openPrice) * 100;

              currentMap.set(symbol, {
                symbol: symbol.replace('USDT', ''),
                pair: symbol,
                price: closePrice,
                change24h: parseFloat(change24h.toFixed(2)),
                high24h: parseFloat(ticker.h),
                low24h: parseFloat(ticker.l),
                volume: parseFloat(ticker.q),
              });
            }
          });

          this.cryptoDataSubject.next(currentMap);
        } catch (e) {
          console.error('Error parsing WebSocket crypto payload:', e);
        }
      });
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 3000);
    };
  }

  public async addCryptoPair(symbolInput: string): Promise<boolean> {
    let cleanSymbol = symbolInput.trim().toUpperCase();
    if (!cleanSymbol.endsWith('USDT')) {
      cleanSymbol += 'USDT';
    }

    if (this.watchedPairs.includes(cleanSymbol)) return false;

    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${cleanSymbol}`);
      const data = await res.json();

      if (data && data.symbol && data.lastPrice) {
        this.watchedPairs.push(cleanSymbol);
        localStorage.setItem('user_watched_crypto', JSON.stringify(this.watchedPairs));

        const currentMap = new Map(this.cryptoDataSubject.value);
        currentMap.set(cleanSymbol, {
          symbol: cleanSymbol.replace('USDT', ''),
          pair: cleanSymbol,
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChangePercent),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
          volume: parseFloat(data.quoteVolume),
        });

        this.zone.run(() => {
          this.cryptoDataSubject.next(currentMap);
        });

        return true;
      }
    } catch (e) {
      console.error('Crypto symbol lookup failed:', e);
    }
    return false;
  }

  public removeCryptoPair(pair: string): void {
    this.watchedPairs = this.watchedPairs.filter((p) => p !== pair);
    localStorage.setItem('user_watched_crypto', JSON.stringify(this.watchedPairs));

    const currentMap = new Map(this.cryptoDataSubject.value);
    currentMap.delete(pair);
    this.cryptoDataSubject.next(currentMap);
  }

  private async fetchInitialPrices() {
    const currentMap = new Map(this.cryptoDataSubject.value);

    for (const pair of this.watchedPairs) {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
        const data = await res.json();

        if (data && data.lastPrice) {
          currentMap.set(pair, {
            symbol: pair.replace('USDT', ''),
            pair: pair,
            price: parseFloat(data.lastPrice),
            change24h: parseFloat(data.priceChangePercent),
            high24h: parseFloat(data.highPrice),
            low24h: parseFloat(data.lowPrice),
            volume: parseFloat(data.quoteVolume),
          });
        }
      } catch (err) {
        console.error(`Initial fetch error for ${pair}`, err);
      }
    }

    this.zone.run(() => {
      this.cryptoDataSubject.next(currentMap);
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}