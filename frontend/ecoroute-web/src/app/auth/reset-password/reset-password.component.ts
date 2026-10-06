import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  showPassword = false;
  showConfirmPassword = false;

  // RESET TOKEN

  token = '';

  // PASSWORD FIELDS

  newPassword = '';
  confirmPassword = '';

  // UI STATES

  isLoading = false;
  isSuccess = false;

  errorMessage = '';
  successMessage = '';

  private readonly apiUrl = 'https://ecoroute-api.runasp.net/api';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  // GET RESET TOKEN

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.token = params.get('token') ?? '';

      if (!this.token) {
        this.errorMessage =
          'This password reset link is invalid or incomplete.';
      }
    });
  }

  // PASSWORD VISIBILITY

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // RESET PASSWORD

  resetPassword(event: Event): void {
    event.preventDefault();

    this.errorMessage = '';
    this.successMessage = '';

    // VALIDATE RESET TOKEN

    if (!this.token) {
      this.errorMessage =
        'This password reset link is invalid or has expired.';
      return;
    }

    // VALIDATE PASSWORD FIELDS

    if (!this.newPassword) {
      this.errorMessage =
        'Please enter a new password.';
      return;
    }

    if (!this.confirmPassword) {
      this.errorMessage =
        'Please confirm your new password.';
      return;
    }

    // PASSWORD LENGTH

    if (this.newPassword.length < 8) {
      this.errorMessage =
        'Password must be at least 8 characters long.';
      return;
    }

    // UPPERCASE

    if (!/[A-Z]/.test(this.newPassword)) {
      this.errorMessage =
        'Password must include at least one uppercase letter.';
      return;
    }

    // LOWERCASE

    if (!/[a-z]/.test(this.newPassword)) {
      this.errorMessage =
        'Password must include at least one lowercase letter.';
      return;
    }

    // NUMBER

    if (!/[0-9]/.test(this.newPassword)) {
      this.errorMessage =
        'Password must include at least one number.';
      return;
    }

    // SPECIAL CHARACTER

    if (!/[^a-zA-Z0-9]/.test(this.newPassword)) {
      this.errorMessage =
        'Password must include at least one special character.';
      return;
    }

    // CONFIRM PASSWORD

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage =
        'Passwords do not match.';
      return;
    }

    // SEND RESET REQUEST

    this.isLoading = true;

    const request = {
      token: this.token,
      newPassword: this.newPassword,
      confirmNewPassword: this.confirmPassword
    };

    this.http
      .post<any>(
        `${this.apiUrl}/Auth/reset-password`,
        request
      )
      .subscribe({
        // SUCCESS

        next: (response) => {
          this.isLoading = false;
          this.isSuccess = true;

          this.successMessage =
            response?.message ??
            'Your password has been reset successfully.';

          // CLEAR PASSWORD FIELDS

          this.newPassword = '';
          this.confirmPassword = '';

          // REDIRECT TO LOGIN

          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },

        // ERROR

        error: (error) => {
          this.isLoading = false;
          this.isSuccess = false;

          this.errorMessage =
            error?.error?.message ??
            'Unable to reset your password. Please try again.';
        }
      });
  }
}