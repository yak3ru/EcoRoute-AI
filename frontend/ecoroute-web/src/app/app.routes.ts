import { Routes } from '@angular/router';

import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';

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
    path: '',
    component: LayoutComponent,
    children: [

      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },

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