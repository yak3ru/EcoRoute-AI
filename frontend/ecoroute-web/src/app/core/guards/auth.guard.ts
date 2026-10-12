
import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isOnboardingRoute =
    state.url.startsWith('/welcome') ||
    state.url.startsWith('/onboarding/');

  // Require a locally stored user before checking the server.
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  // Verify the actual session and onboarding status with the API.
  return authService.getOnboardingStatus().pipe(
    map(response => {
      const isComplete = response.isOnboardingComplete;

      // Keep local status synchronized with the database.
      const user = authService.getUser();

      if (user) {
        localStorage.setItem(
          'ecoroute_user',
          JSON.stringify({
            ...user,
            isOnboardingComplete: isComplete
          })
        );
      }

      // Incomplete accounts must finish onboarding first.
      if (!isComplete && !isOnboardingRoute) {
        return router.createUrlTree(['/welcome']);
      }

      // Completed accounts should not revisit onboarding.
      if (isComplete && isOnboardingRoute) {
        return router.createUrlTree(['/dashboard']);
      }

      return true;
    }),
    catchError((error: HttpErrorResponse) => {
      // Clear local session only when the server rejects it.
      if (error.status === 401 || error.status === 403) {
        authService.clearSession();
        return of(router.createUrlTree(['/login']));
      }

      // Don't silently treat a server/network failure as logged out.
      return of(
        router.createUrlTree(['/login'], {
          queryParams: { error: 'session-check-failed' }
        })
      );
    })
  );
};
