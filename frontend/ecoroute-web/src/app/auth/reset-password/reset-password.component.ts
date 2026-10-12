import { environment } from '../../../environments/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  private readonly apiUrl = `${environment.apiUrl}`;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) { }

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

    const passwordError = validatePassword(this.newPassword);
    if (passwordError) {
      this.errorMessage = passwordError;
      return;
    }

  }
}