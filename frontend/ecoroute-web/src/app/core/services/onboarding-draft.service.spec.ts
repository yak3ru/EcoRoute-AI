import { TestBed } from '@angular/core/testing';

import { OnboardingDraftService } from './onboarding-draft.service';

describe('OnboardingDraftService', () => {
  let service: OnboardingDraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnboardingDraftService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
