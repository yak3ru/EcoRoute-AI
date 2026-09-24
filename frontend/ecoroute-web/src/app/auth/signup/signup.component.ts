import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  imports: [RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {

  showPassword = false;
  showConfirmPassword = false;

  constructor(private router: Router) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  signup(event: Event): void {
    event.preventDefault();

    // Temporary navigation.
    // Real registration will be connected to the backend later.
    this.router.navigate(['/dashboard']);
  }

}