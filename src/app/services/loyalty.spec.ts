import { TestBed } from '@angular/core/testing';

import { Loyalty } from './loyalty';

describe('Loyalty', () => {
  let service: Loyalty;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Loyalty);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
