import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnDestroy {
  email = '';
  submitted = false;
  errorMessage = '';
  successMessage = '';
  isLoading = false;
  isResending = false;
  resendCooldown = 0;

  private cooldownTimer?: ReturnType<typeof setInterval>;
  private readonly apiUrl = 'https://eco-route-ai-yuwx-zeta.vercel.app/api';

  constructor(
    private http: HttpClient
  ) {}

  // SUBMIT RESET

  submitReset(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const email = this.email.trim().toLowerCase();

    // VALIDATE EMAIL

    if (!email) {
      this.errorMessage =
        'Please enter your email address.';
      return;
    }

    if (!this.isValidEmail(email)) {
      this.errorMessage =
        'Please enter a valid email address.';
      return;
    }

    this.email = email;
    this.isLoading = true;

    // SEND RESET REQUEST

    this.http
      .post<any>(
        `${this.apiUrl}/Auth/forgot-password`,
        {
          email: email
        }
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.submitted = true;

          this.successMessage =
            response?.message ??
            'If an account exists with this email address, a password reset link has been sent.';

          this.startResendCooldown();
        },
        error: (error) => {
          this.isLoading = false;

          this.errorMessage =
            error?.error?.message ??
            'Unable to send the password reset email. Please try again.';
        }
      });
  }

  // RESEND EMAIL

  resendEmail(): void {
    if (this.isResending || this.resendCooldown > 0) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    const email = this.email.trim().toLowerCase();

    if (!email) {
      this.errorMessage =
        'Please enter your email address.';
      return;
    }

    this.isResending = true;

    // SEND RESEND REQUEST

    this.http
      .post<any>(
        `${this.apiUrl}/Auth/forgot-password`,
        {
          email: email
        }
      )
      .subscribe({
        next: (response) => {
          this.isResending = false;

          this.successMessage =
            response?.message ??
            'A new password reset link has been sent.';

          this.startResendCooldown();
        },
        error: (error) => {
          this.isResending = false;

          this.errorMessage =
            error?.error?.message ??
            'Unable to resend the password reset email. Please try again.';
        }
      });
  }

  // RESEND COOLDOWN

  private startResendCooldown(): void {
    this.clearCooldown();
    this.resendCooldown = 60;

    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;

      if (this.resendCooldown <= 0) {
        this.clearCooldown();
      }
    }, 1000);
  }

  private clearCooldown(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = undefined;
    }
  }

  // EMAIL VALIDATION

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // CLEANUP

  ngOnDestroy(): void {
    this.clearCooldown();
  }
}