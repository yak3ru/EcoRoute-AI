import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService, UserProfile } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import {
  validateFullName,
  validateEmail,
  validateUsername
} from '../../core/validators/user-input.validator';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss'
})
export class AccountComponent implements OnInit {

  user: UserProfile | null = null;

  isLoading = true;
  isSaving = false;

  errorMessage = '';
  successMessage = '';
  deleteError = '';

  isEditing = false;

  editFullName = '';
  editEmail = '';
  editUsername = '';

  showDeleteModal = false;
  deletePassword = '';
  showPassword = false;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getCurrentUser().subscribe({
      next: (user) => {
        this.user = user;

        this.editFullName = user.fullName;
        this.editEmail = user.email;
        this.editUsername = user.username;

        this.isLoading = false;
      },

      error: (error) => {
        this.isLoading = false;

        if (error.status === 401) {
          this.authService.clearSession();
          this.router.navigate(['/login']);
          return;
        }

        this.errorMessage =
          error.error?.message ??
          'Unable to load your account information.';
      }
    });
  }

  startEditing(): void {
    if (!this.user) {
      return;
    }

    this.editFullName = this.user.fullName;
    this.editEmail = this.user.email;
    this.editUsername = this.user.username;

    this.successMessage = '';
    this.errorMessage = '';
    this.isEditing = true;
  }

  cancelEditing(): void {
    if (this.user) {
      this.editFullName = this.user.fullName;
      this.editEmail = this.user.email;
      this.editUsername = this.user.username;
    }

    this.errorMessage = '';
    this.isEditing = false;
  }

  
saveProfile(): void {
  this.errorMessage = '';
  this.successMessage = '';

  // VALIDATE FULL NAME
  const fullNameError = validateFullName(this.editFullName);

  if (fullNameError) {
    this.errorMessage = fullNameError;
    return;
  }

  // VALIDATE EMAIL
  const emailError = validateEmail(this.editEmail);

  if (emailError) {
    this.errorMessage = emailError;
    return;
  }

  // VALIDATE USERNAME
  const usernameError = validateUsername(this.editUsername);

  if (usernameError) {
    this.errorMessage = usernameError;
    return;
  }

  // SUBMIT VALIDATED DATA
  this.isSaving = true;

  this.userService.updateAccount({
    fullName: this.editFullName.trim(),
    email: this.editEmail.trim(),
    username: this.editUsername.trim()
  }).subscribe({
    next: (response) => {
      this.isSaving = false;

      this.successMessage =
        response?.message ??
        'Your account information has been updated successfully.';

      this.isEditing = false;

      this.loadUser();
    },

    error: (error) => {
      this.isSaving = false;

      this.errorMessage =
        error.error?.message ??
        'Unable to update your account information.';
    }
  });
}


  openDeleteModal(): void {
    this.showDeleteModal = true;
    this.deletePassword = '';
    this.showPassword = false;
    this.errorMessage = '';
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletePassword = '';
    this.showPassword = false;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  confirmDeleteAccount(): void {
    if (!this.deletePassword.trim()) {
      this.errorMessage = 'Please enter your password.';
      return;
    }

    this.deleteError = '';

    this.userService.deleteAccount(this.deletePassword.trim()).subscribe({
      next: () => {
        this.authService.clearSession();
        this.closeDeleteModal();
        this.router.navigate(['/login']);
      },

      error: (error) => {
        this.deleteError =
          error.error?.message ??
          'Unable to delete your account.';
      }
    });
  }

  getInitials(fullName: string | undefined | null): string {
  if (!fullName?.trim()) {
    return '';
  }

  const nameParts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length === 1) {
    return nameParts[0].substring(0, 2).toUpperCase();
  }

  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  return (
    firstName.charAt(0) +
    lastName.charAt(0)
  ).toUpperCase();
}

}