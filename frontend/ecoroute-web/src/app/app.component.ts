import { Component } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  constructor(
    private router: Router,
    private title: Title
  ) {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {

        const titles: { [key: string]: string } = {
          '/login': 'Login',
          '/signup': 'Sign Up',
          '/dashboard': 'Dashboard',
          '/waste-data': 'Waste Data',
          '/route-planning': 'Route Planning'
        };

        const pageTitle = titles[event.urlAfterRedirects] || 'EcoRoute AI';

        this.title.setTitle(`EcoRoute AI | ${pageTitle}`);
      });
  }
}