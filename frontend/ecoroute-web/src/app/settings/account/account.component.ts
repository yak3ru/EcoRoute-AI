import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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

export class AccountComponent {

  showDeleteModal = false;

  deletePassword = '';

  showPassword = false;

  openDeleteModal(): void {
    this.showDeleteModal = true;
    this.deletePassword = '';
    this.showPassword = false;
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
      return;
    }

    // Backend account deletion will be connected here later.
    console.log('Account deletion requested');

  }

}