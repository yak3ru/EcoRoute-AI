import { Routes } from '@angular/router';

import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './auth/reset-password/reset-password.component';
import { WelcomeComponent } from './onboarding/welcome/welcome.component';
import { ImportDataComponent } from './onboarding/import-data/import-data.component';
import { AddTrucksComponent } from './onboarding/add-trucks/add-trucks.component';

import { TermsOfServiceComponent } from './terms-of-service/terms-of-service.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';

import { LayoutComponent } from './shared/layout/layout.component';

import { DashboardComponent } from './dashboard/dashboard.component';
import { WasteDataComponent } from './waste-data/waste-data.component';
import { RoutePlanningComponent } from './route-planning/route-planning.component';

import { SettingsComponent } from './settings/settings.component';
import { AccountComponent } from './settings/account/account.component';
import { SecurityComponent } from './settings/security/security.component';
import { NotificationsComponent } from './settings/notifications/notifications.component';
import { SystemComponent } from './settings/system/system.component';
import { DataPreferencesComponent } from './settings/data-preferences/data-preferences.component';

import { authGuard } from './core/guards/auth.guard';
import { TwoFactorComponent } from './auth/two-factor/two-factor.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },

  {
    path: 'signup',
    component: SignupComponent
  },

{
  path: 'welcome',
  component: WelcomeComponent,
  canActivate: [authGuard]
},
{
  path: 'onboarding/import-data',
  component: ImportDataComponent,
  canActivate: [authGuard]
},
{
  path: 'onboarding/add-trucks',
  component: AddTrucksComponent,
  canActivate: [authGuard]
},

  {
    path: 'terms-of-service',
    component: TermsOfServiceComponent
  },

  {
    path: 'privacy-policy',
    component: PrivacyPolicyComponent
  },

  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },

  {
    path: 'reset-password',
    component: ResetPasswordComponent
  },

  {
    path: 'verify-code',
    component: TwoFactorComponent
  },

  {
  path: '',
  pathMatch: 'full',
  redirectTo: 'dashboard'
},

  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [

      {
        path: 'dashboard',
        component: DashboardComponent
      },

      {
        path: 'waste-data',
        component: WasteDataComponent
      },

      {
        path: 'route-planning',
        component: RoutePlanningComponent
      },

      {
        path: 'settings',
        component: SettingsComponent,
        children: [
          {
            path: '',
            redirectTo: 'account',
            pathMatch: 'full'
          },

          {
            path: 'account',
            component: AccountComponent
          },

          {
            path: 'security',
            component: SecurityComponent
          },

          {
            path: 'notifications',
            component: NotificationsComponent
          },

          {
            path: 'system',
            component: SystemComponent
          },

          {
            path: 'data-preferences',
            component: DataPreferencesComponent
          }
        ]
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];