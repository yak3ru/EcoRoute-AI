import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { AuthService, isTwoFactorRequired } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, NgIf],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  usernameOrEmail = '';
  password = '';
  rememberMe = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  // PASSWORD VISIBILITY

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // LOGIN

  login(event: Event): void {
    event.preventDefault();

    this.errorMessage = '';

    // VALIDATE FIELDS

    if (!this.usernameOrEmail.trim()) {
      this.errorMessage = 'Please enter your username or email.';
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Please enter your password.';
      return;
    }

    this.isLoading = true;

    // SEND LOGIN REQUEST

    this.authService.login({
      usernameOrEmail: this.usernameOrEmail.trim(),
      password: this.password,
      rememberMe: this.rememberMe
    }).subscribe({
      next: (response) => {
        this.isLoading = false;

        // NEW DEVICE: ASK FOR THE CODE

        if (isTwoFactorRequired(response)) {
          this.router.navigate(['/verify-code']);
          return;
        }

        this.router.navigate([
          response.isOnboardingComplete ? '/dashboard' : '/welcome'
        ]);
      },

      error: (error) => {
        this.isLoading = false;

        if (error.status === 401) {
          this.errorMessage = 'Invalid username/email or password.';
        } else if (error.status === 400 || error.status === 429) {
          this.errorMessage =
            error.error?.message ?? 'Please check your login details.';
        } else if (error.status === 500) {
          this.errorMessage =
            error.error?.message ?? 'Something went wrong. Please try again.';
        } else {
          this.errorMessage =
            'Unable to connect to the server. Please try again.';
        }
      }
    });
  }
}