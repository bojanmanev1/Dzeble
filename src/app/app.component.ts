import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { DeviceTrackerService } from './services/device-tracker';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private deviceTracker = inject(DeviceTrackerService);

  ngOnInit() {
    // Seamlessly tracks user footprint in the background without blocking the UI
    this.deviceTracker.trackDevice().catch(err => console.error('Tracking error:', err));
  }
}