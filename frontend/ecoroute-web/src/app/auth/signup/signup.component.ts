import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    NgIf
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  showPassword = false;
  showConfirmPassword = false;

  fullName = '';
  email = '';
  username = '';
  password = '';
  confirmPassword = '';
  agreeToTerms = false;

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  private readonly apiUrl = 'http://localhost:5276/api';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  // PASSWORD VISIBILITY

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // SIGN UP

  signup(event: Event): void {
    event.preventDefault();

    this.errorMessage = '';
    this.successMessage = '';

    // REQUIRED FIELDS

    if (!this.fullName.trim()) {
      this.errorMessage = 'Please enter your full name.';
      return;
    }

    if (!this.email.trim()) {
      this.errorMessage = 'Please enter your email address.';
      return;
    }

    if (!this.username.trim()) {
      this.errorMessage = 'Please enter a username.';
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Please enter a password.';
      return;
    }

    if (!this.confirmPassword) {
      this.errorMessage = 'Please confirm your password.';
      return;
    }

    // PASSWORD REQUIREMENTS

    if (this.password.length < 8) {
      this.errorMessage =
        'Password must be at least 8 characters long.';
      return;
    }

    if (!/[A-Z]/.test(this.password)) {
      this.errorMessage =
        'Password must include at least one uppercase letter.';
      return;
    }

    if (!/[a-z]/.test(this.password)) {
      this.errorMessage =
        'Password must include at least one lowercase letter.';
      return;
    }

    if (!/[0-9]/.test(this.password)) {
      this.errorMessage =
        'Password must include at least one number.';
      return;
    }

    if (!/[^a-zA-Z0-9]/.test(this.password)) {
      this.errorMessage =
        'Password must include at least one special character.';
      return;
    }

    // CONFIRM PASSWORD

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    // TERMS

    if (!this.agreeToTerms) {
      this.errorMessage =
        'You must agree to the Terms of Service and Privacy Policy.';
      return;
    }

    // SEND REGISTRATION REQUEST

    this.isLoading = true;

    this.http.post<any>(
      `${this.apiUrl}/Auth/register`,
      {
        fullName: this.fullName.trim(),
        email: this.email.trim(),
        username: this.username.trim(),
        password: this.password,
        confirmPassword: this.confirmPassword,
        agreeToTerms: this.agreeToTerms
      }
    ).subscribe({
      next: (response) => {
        this.isLoading = false;

        this.successMessage =
          response?.message ??
          'Account created successfully.';

        // REDIRECT TO LOGIN

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1000);
      },

      error: (error) => {
        this.isLoading = false;

        if (error.status === 409) {
          this.errorMessage =
            error.error?.message ??
            'Email or username is already registered.';
        } else if (error.status === 400) {
          this.errorMessage =
            error.error?.message ??
            'Please check your registration details.';
        } else {
          this.errorMessage =
            'Unable to create your account. Please try again.';
        }
      }
    });
  }
}