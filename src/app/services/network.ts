import { Injectable, NgZone } from '@angular/core';
import { Network, ConnectionStatus } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private statusSubject = new BehaviorSubject<boolean>(true);
  public isOnline$: Observable<boolean> = this.statusSubject.asObservable();

  constructor(private zone: NgZone) {
    this.initNetworkListener();
  }

  private async initNetworkListener() {
    // Check initial connection status on app launch
    const status = await Network.getStatus();
    this.statusSubject.next(status.connected);

    // Listen for real-time network changes globally
    Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      this.zone.run(() => {
        this.statusSubject.next(status.connected);
      });
    });
  }

  public get isOnline(): boolean {
    return this.statusSubject.value;
  }
}