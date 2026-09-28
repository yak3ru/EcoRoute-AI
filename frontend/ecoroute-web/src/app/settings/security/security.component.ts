import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss'
})
export class SecurityComponent {

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  twoFactorEnabled = false;

  passwordError = '';
  passwordSuccess = '';
  isUpdatingPassword = false;

  sessions = [
    {
      device: 'Current Session',
      browser: 'Current browser',
      location: 'Current device',
      date: '',
      time: '',
      status: 'Active',
      current: true,
      icon: 'laptop.svg'
    }
  ];

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  toggleCurrentPassword(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  updatePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.currentPassword.trim()) {
      this.passwordError = 'Please enter your current password.';
      return;
    }

    if (!this.newPassword.trim()) {
      this.passwordError = 'Please enter a new password.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.passwordError =
        'Your new password must be at least 8 characters.';
      return;
    }

    if (!/[A-Z]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one uppercase letter.';
      return;
    }

    if (!/[a-z]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one lowercase letter.';
      return;
    }

    if (!/[0-9]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one number.';
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>\_\\-`\~+=;]/.test(this.newPassword)) {
      this.passwordError =
        'Your new password must include at least one special character.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New passwords do not match.';
      return;
    }

    if (this.currentPassword === this.newPassword) {
      this.passwordError =
        'Your new password must be different from your current password.';
      return;
    }

    this.isUpdatingPassword = true;

    this.userService.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
      confirmNewPassword: this.confirmPassword
    }).subscribe({
      next: (response) => {
        this.isUpdatingPassword = false;

        this.passwordSuccess =
          response?.message ??
          'Your password has been updated successfully.';

        this.clearPasswordFields();
      },

      error: (error) => {
        this.isUpdatingPassword = false;

        this.passwordError =
          error.error?.message ??
          'Unable to update your password.';
      }
    });
  }

  private clearPasswordFields(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';

    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
  }

  toggleTwoFactor(): void {
    this.twoFactorEnabled = !this.twoFactorEnabled;
  }

  logoutSession(index: number): void {
    if (this.sessions[index].current) {
      return;
    }

    this.sessions[index].status = 'Inactive';
  }

}