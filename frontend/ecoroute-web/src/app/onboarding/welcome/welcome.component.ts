
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingDraftService } from '../../core/services/onboarding-draft.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss'
})
export class WelcomeComponent {
  constructor(
    private router: Router,
    private onboardingDraft: OnboardingDraftService
  ) {}

  getStarted(): void {
    this.onboardingDraft.currentStep = 1;
    this.router.navigate(['/onboarding/import-data']);
  }
}
