import {
  AfterViewInit,
  Component,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';

import * as L from 'leaflet';

interface Route {
  id: string;
  area: string;
  vehicle: string;
  wasteLoad: string;
  stops: number;
  distance: string;
  status: 'Active' | 'Pending';
  eta: string;
  estimatedTime: string;
  predictedWaste: string;
  sequence: string[];
  color: string;
}

@Component({
  selector: 'app-route-planning',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './route-planning.component.html',
  styleUrl: './route-planning.component.scss'
})
export class RoutePlanningComponent implements AfterViewInit, OnDestroy {
  selectedRouteId = '#01';
  isOptimizing = false;
  isRoutePanelOpen = true;

  closeRoutePanel(): void {
    this.isRoutePanelOpen = false;

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  private map!: L.Map;

  routes: Route[] = [
    {
      id: '#01',
      area: 'Silverhills → Maryville',
      vehicle: 'Truck 3',
      wasteLoad: '5,240 kg',
      stops: 12,
      distance: '8.4 km',
      status: 'Active',
      eta: '1:15 PM',
      estimatedTime: '1h 15m',
      predictedWaste: '5,240 kg',
      sequence: [
        'Silverhills Subdivision (Purok 1)',
        'Silverhills Subdivision (Purok 2)',
        'Maryville Subdivision (Block A)',
        'Maryville Subdivision (Block B)'
      ],
      color: '#0a8f3d'
    },
    {
      id: '#02',
      area: 'Joseville → Sunny Hills',
      vehicle: 'Truck 2',
      wasteLoad: '4,180 kg',
      stops: 9,
      distance: '6.8 km',
      status: 'Pending',
      eta: '2:30 PM',
      estimatedTime: '1h 05m',
      predictedWaste: '4,180 kg',
      sequence: [
        'Joseville Subdivision',
        'Talamban Collection Point',
        'Sunny Hills Block A',
        'Sunny Hills Block B'
      ],
      color: '#1675d1'
    },
    {
      id: '#03',
      area: 'Garnetville',
      vehicle: 'Truck 1',
      wasteLoad: '2,950 kg',
      stops: 7,
      distance: '5.1 km',
      status: 'Active',
      eta: '1:45 PM',
      estimatedTime: '55m',
      predictedWaste: '2,950 kg',
      sequence: [
        'Garnetville Purok 1',
        'Garnetville Purok 2',
        'Garnetville Central',
        'Garnetville Exit Road'
      ],
      color: '#f7941d'
    },
    {
      id: '#04',
      area: 'Zone 67',
      vehicle: 'Truck 4',
      wasteLoad: '7,440 kg',
      stops: 10,
      distance: '5.2 km',
      status: 'Active',
      eta: '2:50 PM',
      estimatedTime: '1h 20m',
      predictedWaste: '7,440 kg',
      sequence: [
        'Zone 67 Purok 1',
        'Zone 67 Purok 2',
        'Zone 67 Central',
        'Zone 67 Collection Area'
      ],
      color: '#ed2424'
    }
  ];

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  get selectedRoute(): Route {
    return this.routes.find(
      route => route.id === this.selectedRouteId
    ) ?? this.routes[0];
  }

  selectRoute(route: Route): void {
    this.selectedRouteId = route.id;
    this.isRoutePanelOpen = true;

    setTimeout(() => {
      this.focusRoute(route);
      this.map?.invalidateSize();
    }, 200);
  }

  viewRoute(route: Route): void {
    this.selectedRouteId = route.id;
    this.isRoutePanelOpen = true;

    setTimeout(() => {
      this.focusRoute(route);
      this.map?.invalidateSize();
    }, 200);
  }

  viewConstraints(): void {
    alert(
      'Route constraints:\n\n' +
      '• Vehicle capacity\n' +
      '• Collection time windows\n' +
      '• Road accessibility\n' +
      '• Predicted waste volume\n' +
      '• Maximum route distance'
    );
  }

  optimizeRoutes(): void {
    if (this.isOptimizing) {
      return;
    }

    this.isOptimizing = true;

    setTimeout(() => {
      this.isOptimizing = false;
      alert('Routes optimized successfully.');
    }, 1200);
  }

  reroute(): void {
    alert(`Rerouting ${this.selectedRoute.id}...`);
  }

  applyChanges(): void {
    alert(`Changes applied to Route ${this.selectedRoute.id}.`);
  }

  // MAP

  private initializeMap(): void {
    this.map = L.map('routeMap', {
      zoomControl: false
    }).setView([10.3573, 123.9160], 13);

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    ).addTo(this.map);

    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    this.drawRoutes();

    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  }

  private drawRoutes(): void {
    const routeCoordinates: Record<string, [number, number][]> = {
      '#01': [
        [10.3820, 123.9070],
        [10.3745, 123.9110],
        [10.3680, 123.9180],
        [10.3615, 123.9240],
        [10.3555, 123.9290]
      ],

      '#02': [
        [10.3480, 123.9070],
        [10.3535, 123.9130],
        [10.3590, 123.9170],
        [10.3650, 123.9200],
        [10.3700, 123.9260]
      ],

      '#03': [
        [10.3470, 123.8900],
        [10.3510, 123.8950],
        [10.3570, 123.8990],
        [10.3630, 123.9030],
        [10.3690, 123.9070]
      ],

      '#04': [
        [10.3600, 123.9400],
        [10.3650, 123.9440],
        [10.3700, 123.9480],
        [10.3760, 123.9510],
        [10.3820, 123.9540]
      ]
    };

    this.routes.forEach(route => {
      const coordinates = routeCoordinates[route.id];

      if (!coordinates) {
        return;
      }

      L.polyline(coordinates, {
        color: route.color,
        weight: 4,
        opacity: 0.9
      }).addTo(this.map);

      coordinates.forEach((coordinate, index) => {
        const marker = L.marker(coordinate, {
          icon: L.divIcon({
            className: 'route-number-marker',
            html: `
              <div style="
                background:${route.color};
                width:24px;
                height:24px;
                border-radius:50%;
                color:white;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:11px;
                font-weight:700;
                border:2px solid white;
                box-shadow:0 1px 5px rgba(0,0,0,.3);
              ">
                ${index + 1}
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        });

        marker
          .bindTooltip(
            `${route.id} — Stop ${index + 1}`,
            {
              direction: 'top'
            }
          )
          .addTo(this.map);
      });
    });
  }

  private focusRoute(route: Route): void {
    if (!this.map) {
      return;
    }

    const routeCoordinates: Record<string, [number, number][]> = {
      '#01': [
        [10.3820, 123.9070],
        [10.3745, 123.9110],
        [10.3680, 123.9180],
        [10.3615, 123.9240],
        [10.3555, 123.9290]
      ],

      '#02': [
        [10.3480, 123.9070],
        [10.3535, 123.9130],
        [10.3590, 123.9170],
        [10.3650, 123.9200],
        [10.3700, 123.9260]
      ],

      '#03': [
        [10.3470, 123.8900],
        [10.3510, 123.8950],
        [10.3570, 123.8990],
        [10.3630, 123.9030],
        [10.3690, 123.9070]
      ],

      '#04': [
        [10.3600, 123.9400],
        [10.3650, 123.9440],
        [10.3700, 123.9480],
        [10.3760, 123.9510],
        [10.3820, 123.9540]
      ]
    };

    const coordinates = routeCoordinates[route.id];

    if (coordinates) {
      this.map.fitBounds(
        L.latLngBounds(coordinates),
        {
          padding: [30, 30]
        }
      );
    }
  }
}