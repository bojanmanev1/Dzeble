import { TestBed } from '@angular/core/testing';

import { DeviceTracker } from './device-tracker';

describe('DeviceTracker', () => {
  let service: DeviceTracker;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeviceTracker);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
