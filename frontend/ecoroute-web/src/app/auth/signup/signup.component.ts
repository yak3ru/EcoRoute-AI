import { environment } from '../../../environments/environment';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  AuthService,
  isTwoFactorRequired
} from '../../core/services/auth.service';
import { validateEmail, validateFullName, validatePassword, validateUsername } from '../../core/validators/user-input.validator';



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


private readonly signupDraftKey = 'ecoroute_signup_draft';

private saveSignupDraft(): void {
  sessionStorage.setItem(
    this.signupDraftKey,
    JSON.stringify({
      fullName: this.fullName,
      email: this.email,
      username: this.username,
      agreeToTerms: this.agreeToTerms
    })
  );
}

private restoreSignupDraft(): void {
  const savedDraft = sessionStorage.getItem(this.signupDraftKey);

  if (!savedDraft) return;

  try {
    const draft = JSON.parse(savedDraft);

    this.fullName = draft.fullName ?? '';
    this.email = draft.email ?? '';
    this.username = draft.username ?? '';
    this.agreeToTerms = draft.agreeToTerms ?? false;
  } catch {
    sessionStorage.removeItem(this.signupDraftKey);
  }
}

private clearSignupDraft(): void {
  sessionStorage.removeItem(this.signupDraftKey);
}


saveDraftAndNavigate(route: string): void {
  this.saveSignupDraft();
  this.router.navigate([route]);
}



  isLoading = false;
  errorMessage = '';
  successMessage = '';

  private readonly apiUrl = `${environment.apiUrl}`;

  
constructor(
  private router: Router,
  private http: HttpClient,
  private authService: AuthService
) {
  const navigation = this.router.getCurrentNavigation();
  const previousUrl =
    navigation?.previousNavigation?.finalUrl?.toString() ?? '';

  const returnedFromLegalPage =
    previousUrl.startsWith('/terms-of-service') ||
    previousUrl.startsWith('/privacy-policy');

  if (returnedFromLegalPage) {
    this.restoreSignupDraft();
  } else {
    this.clearSignupDraft();
  }
}

leaveSignup(): void {
  this.clearSignupDraft();
  this.router.navigate(['/login']);
}

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

    // FORMAT CHECKS

    const validationError =
      validateFullName(this.fullName.trim()) ??
      validateEmail(this.email.trim()) ??
      validateUsername(this.username.trim()) ??
      validatePassword(this.password);

    if (validationError) {
      this.errorMessage = validationError;
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
        this.successMessage =
          response?.message ?? 'Account created successfully.';
          this.clearSignupDraft();

        // Automatically log in the newly registered user.
        this.authService.login({
          usernameOrEmail: this.username.trim(),
          password: this.password,
          rememberMe: false
        }).subscribe({
          next: (loginResponse) => {
            this.isLoading = false;

            if (isTwoFactorRequired(loginResponse)) {
              this.router.navigate(['/verify-code']);
              return;
            }

            this.router.navigate(['/welcome']);
          },
          error: () => {
            this.isLoading = false;

            // Account creation succeeded, but login did not.
            this.successMessage =
              'Account created successfully. Please log in to continue.';
            this.errorMessage = '';
            this.router.navigate(['/login']);
          }
        });
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