
import { environment } from '../../../environments/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { validatePassword } from '../../core/validators/user-input.validator';

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

  token = '';

  newPassword = '';
  confirmPassword = '';

  isLoading = false;
  isSuccess = false;

  errorMessage = '';
  successMessage = '';

  private readonly apiUrl = `${environment.apiUrl}`;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.token = params.get('token') ?? '';

      if (!this.token) {
        this.errorMessage =
          'This password reset link is invalid or incomplete.';
      } else {
        this.errorMessage = '';
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  resetPassword(form: NgForm): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.isLoading) {
      return;
    }

    if (!this.token) {
      this.errorMessage =
        'This password reset link is invalid or has expired.';
      return;
    }

    // Read the current values from the Angular form.
    const newPassword =
      String(form.value.newPassword ?? this.newPassword);

    const confirmPassword =
      String(form.value.confirmPassword ?? this.confirmPassword);

    if (!newPassword.trim()) {
      this.errorMessage = 'Please enter a new password.';
      return;
    }

    if (!confirmPassword) {
      this.errorMessage = 'Please confirm your new password.';
      return;
    }

    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      this.errorMessage = passwordError;
      return;
    }

    if (newPassword !== confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.newPassword = newPassword;
    this.confirmPassword = confirmPassword;
    this.isLoading = true;

    
this.http.post<any>(
  `${this.apiUrl}/Auth/reset-password`,
  {
    token: this.token,
    newPassword: newPassword,
    confirmNewPassword: confirmPassword
  }
).subscribe({
  next: (response) => {
    this.isLoading = false;
    this.isSuccess = true;
    this.successMessage =
      response?.message ??
      'Your password has been reset successfully. Redirecting to login...';

    this.newPassword = '';
    this.confirmPassword = '';
    // Redirect to login after 2 seconds
  setTimeout(() => {
    this.router.navigate(['/login']);
  }, 2000);
  },
  error: (error) => {
    this.isLoading = false;
    this.errorMessage =
      error?.error?.message ??
      'Unable to reset your password. The link may have expired. Please try again.';
  }
});

  }
}
