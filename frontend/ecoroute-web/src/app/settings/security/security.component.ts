import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  // Password fields
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // Password visibility
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // 2FA
  twoFactorEnabled = false;

  // Password update
  passwordError = '';
  passwordSuccess = '';

  // Active sessions
  sessions = [
    {
      device: 'MacBook Air (This device)',
      browser: 'Chrome 129.0.0.0 macOS',
      location: 'Cebu, Philippines',
      date: 'Sep 16, 2026',
      time: '10:24 AM',
      status: 'Active',
      current: true,
      icon: 'laptop.svg'
    },
    {
      device: 'Windows PC',
      browser: 'Chrome 128.0.0.0 Windows 11',
      location: 'Cebu, Philippines',
      date: 'Sep 16, 2026',
      time: '03:15 PM',
      status: 'Inactive',
      current: false,
      icon: 'system.svg'
    }
  ];

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
      this.passwordError = 'Your new password must be at least 8 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New passwords do not match.';
      return;
    }

    // Backend password update will be connected here later.
    this.passwordSuccess = 'Your password has been updated successfully.';

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
    this.sessions[index].status = 'Inactive';
  }
}