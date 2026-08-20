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

  // Track target pairs
  private watchedPairs = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 
    'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'
  ];

  constructor(private zone: NgZone) {}

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Connect to Binance multi-stream WebSocket for mini-tickers
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

    this.ws.onerror = (err) => {
      console.error('Crypto WebSocket error:', err);
    };

    this.ws.onclose = () => {
      // Reconnect after 3 seconds if disconnected
      setTimeout(() => this.connect(), 3000);
    };
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}