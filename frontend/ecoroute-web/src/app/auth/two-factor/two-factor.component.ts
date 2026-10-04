import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-two-factor',
  imports: [NgIf, NgFor],
  templateUrl: './two-factor.component.html',
  styleUrl: './two-factor.component.scss'
})
export class TwoFactorComponent implements OnInit, OnDestroy {
  @ViewChildren('digitInput')
  digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  digits = ['', '', '', ''];
  maskedEmail = '';

  isVerifying = false;
  isResending = false;
  errorMessage = '';
  successMessage = '';

  resendCooldown = 0;
  sessionEnded = false;

  private cooldownTimer?: ReturnType<typeof setInterval>;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const pending = this.authService.getPendingTwoFactor();

    // OPENED DIRECTLY, NOTHING TO VERIFY

    if (!pending) {
      this.router.navigate(['/login']);
      return;
    }

    this.maskedEmail = pending.maskedEmail;
    this.startCooldown(pending.resendAvailableAt);
  }

  ngOnDestroy(): void {
    this.stopCooldown();
  }

  // CODE INPUT

  get code(): string {
    return this.digits.join('');
  }

  get isCodeComplete(): boolean {
    return /^\d{4}$/.test(this.code);
  }

  trackByIndex(index: number): number {
    return index;
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');

    this.errorMessage = '';

    // AUTOFILL OR MULTIPLE DIGITS

    if (value.length > 1) {
      this.fillDigits(value);
      return;
    }

    this.digits[index] = value;
    input.value = value;

    if (value && index < 3) {
      this.focusDigit(index + 1);
    }
  }

  onDigitKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      this.focusDigit(index - 1);
    }

    if (event.key === 'Enter') {
      this.verify();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();

    const pasted = event.clipboardData?.getData('text') ?? '';
    this.fillDigits(pasted.replace(/\D/g, ''));
  }

  // VERIFY

  verify(): void {
    if (this.isVerifying || this.sessionEnded) {
      return;
    }

    if (!this.isCodeComplete) {
      this.errorMessage = 'Please enter the 4-digit code.';
      return;
    }

    this.isVerifying = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.verifyTwoFactor(this.code).subscribe({
      next: () => {
        this.isVerifying = false;
        this.router.navigate(['/dashboard']);
      },

      error: (error: HttpErrorResponse) => {
        this.isVerifying = false;
        this.handleError(error);
        this.clearDigits();
      }
    });
  }

  // RESEND

  resend(): void {
    if (this.resendCooldown > 0 || this.isResending || this.sessionEnded) {
      return;
    }

    this.isResending = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.resendTwoFactorCode().subscribe({
      next: (response) => {
        this.isResending = false;
        this.successMessage = 'A new code has been sent to your email.';
        this.clearDigits();
        this.startCooldown(
          Date.now() + response.resendAvailableInSeconds * 1000
        );
      },

      error: (error: HttpErrorResponse) => {
        this.isResending = false;

        if (error.error?.errorCode === 'RESEND_COOLDOWN') {
          const seconds = error.error.retryAfterSeconds ?? 60;

          this.authService.setResendAvailableIn(seconds);
          this.startCooldown(Date.now() + seconds * 1000);
        }

        this.handleError(error);
      }
    });
  }

  backToLogin(): void {
    this.authService.clearPendingTwoFactor();
    this.router.navigate(['/login']);
  }

  // ERRORS

  private handleError(error: HttpErrorResponse): void {
    const errorCode = error.error?.errorCode;

    switch (errorCode) {
      case 'INVALID_CODE':
        this.errorMessage =
          error.error?.message ?? 'Incorrect code. Please try again.';
        break;

      case 'CODE_EXPIRED':
        this.errorMessage = 'This code has expired. Please request a new one.';
        break;

      case 'RESEND_COOLDOWN':
        this.errorMessage = error.error?.message;
        break;

      // SESSION OVER: LOG IN AGAIN

      case 'TOO_MANY_ATTEMPTS':
      case 'TOO_MANY_RESENDS':
      case 'CODE_USED':
      case 'INVALID_CHALLENGE':
      case 'CHALLENGE_EXPIRED':
        this.errorMessage =
          error.error?.message ?? 'Please log in again.';
        this.sessionEnded = true;
        this.authService.clearPendingTwoFactor();
        this.stopCooldown();
        break;

      default:
        if (error.status === 429) {
          this.errorMessage =
            'Too many requests. Please wait a moment and try again.';
        } else if (error.status === 0) {
          this.errorMessage =
            'Unable to connect to the server. Please try again.';
        } else {
          this.errorMessage =
            error.error?.message ?? 'Something went wrong. Please try again.';
        }
    }
  }

  // COOLDOWN TIMER

  private startCooldown(resendAvailableAt: number): void {
    this.stopCooldown();

    const tick = () => {
      this.resendCooldown = Math.max(
        0,
        Math.ceil((resendAvailableAt - Date.now()) / 1000)
      );

      if (this.resendCooldown === 0) {
        this.stopCooldown();
      }
    };

    tick();
    this.cooldownTimer = setInterval(tick, 1000);
  }

  private stopCooldown(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = undefined;
    }
  }

  // HELPERS

  private fillDigits(value: string): void {
    const chars = value.slice(0, 4).split('');

    this.digits = [0, 1, 2, 3].map(i => chars[i] ?? '');
    this.focusDigit(Math.min(chars.length, 3));
  }

  private clearDigits(): void {
    this.digits = ['', '', '', ''];
    this.focusDigit(0);
  }

  private focusDigit(index: number): void {
    setTimeout(() => {
      this.digitInputs?.get(index)?.nativeElement.focus();
    });
  }
}
