import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import * as L from 'leaflet';

interface RoadRouteResponse {
  code: string;

  routes: {
    geometry: {
      coordinates: [number, number][];
    };

    distance: number;
    duration: number;
  }[];
}

interface MlRouteArea {
  area_id: number;
  area_name: string;
  predicted_waste_kg: number;
  p10_kg: number;
  p50_kg: number;
  p90_kg: number;
}

interface MlRoute {
  vehicle_id: number;
  vehicle_name: string;
  capacity_kg: number;
  maximum_distance_km: number;
  collection_start: string;
  collection_end: string;
  road_accessibility: string;
  area_restrictions: string;
  load_kg: number;
  areas: MlRouteArea[];
  distance_km: number;
  remaining_capacity_kg: number;
  distance_exceeded: boolean;
}

interface MlRoutesResponse {
  status: string;
  mode: string;
  routes: MlRoute[];
  unassigned: unknown[];
}

interface AreaLocation {
  areaId: number;
  areaName: string;
  latitude: number;
  longitude: number;
}

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

  vehicleId: number;
  capacityKg: number;
  remainingCapacityKg: number;
  maximumDistanceKm: number;
  collectionStart: string;
  collectionEnd: string;
  roadAccessibility: string;
  areaRestrictions: string;

  areas: MlRouteArea[];
  coordinates: [number, number][];
}

interface AreaApiResponse {
  areaId: number;
  areaName: string;
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-route-planning',
  standalone: true,
  imports: [
  CommonModule,
  FormsModule
],
  templateUrl: './route-planning.component.html',
  styleUrl: './route-planning.component.scss'
})
export class RoutePlanningComponent
  implements OnInit, AfterViewInit, OnDestroy {

  private roadGeometry = new Map<
    string,
    [number, number][]
  >();

  private http = inject(HttpClient);

  private readonly mlApiUrl = 'http://localhost:5276/api/ml';
  private readonly areasApiUrl = 'http://localhost:5276/api/areas';

  private subscriptions = new Subscription();

  private map!: L.Map;

  private routeLayerGroup!: L.LayerGroup;

  private areaLocations = new Map<number, AreaLocation>();

  selectedRouteId = '';

  isOptimizing = false;
  isLoadingRoutes = true;
  isRoutePanelOpen = true;

  searchTerm = '';

  routeMode = 'P90 Safety Planning';

  routes: Route[] = [];

  readonly routeColors = [
    '#0a8f3d',
    '#1675d1',
    '#f7941d',
    '#ed2424',
    '#8b5cf6',
    '#0891b2',
    '#e11d48',
    '#65a30d'
  ];

  ngOnInit(): void {
    this.loadAreasAndRoutes();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();

    if (this.map) {
      this.map.remove();
    }
  }

  get selectedRoute(): Route | undefined {
    return this.routes.find(
      route => route.id === this.selectedRouteId
    );
  }

  get filteredRoutes(): Route[] {
    const search = this.searchTerm.trim().toLowerCase();

    if (!search) {
      return this.routes;
    }

    return this.routes.filter(route =>
      route.id.toLowerCase().includes(search) ||
      route.area.toLowerCase().includes(search) ||
      route.vehicle.toLowerCase().includes(search) ||
      route.sequence.some(stop =>
        stop.toLowerCase().includes(search)
      )
    );
  }

  get activeRouteCount(): number {
    return this.routes.filter(
      route => route.status === 'Active'
    ).length;
  }

  get vehiclesDeployed(): number {
    return new Set(
      this.routes.map(route => route.vehicleId)
    ).size;
  }

  get totalDistance(): number {
    return this.routes.reduce(
      (total, route) => total + this.parseNumber(route.distance),
      0
    );
  }

  get collectionStart(): string {
    if (!this.routes.length) {
      return '--';
    }

    return this.formatTime(
      this.routes[0].collectionStart
    );
  }

  get collectionEnd(): string {
    if (!this.routes.length) {
      return '--';
    }

    return this.formatTime(
      this.routes[0].collectionEnd
    );
  }

  get hasUnassignedAreas(): boolean {
    return false;
  }

  closeRoutePanel(): void {
    this.isRoutePanelOpen = false;

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
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
    this.selectRoute(route);
  }

  // ============================================================
  // LOAD DATA
  // ============================================================

  private loadAreasAndRoutes(): void {
    this.isLoadingRoutes = true;

    this.subscriptions.add(
      this.http
        .get<AreaApiResponse[]>(this.areasApiUrl)
        .subscribe({
          next: areas => {
            this.areaLocations.clear();

            areas.forEach(area => {
              this.areaLocations.set(
                area.areaId,
                {
                  areaId: area.areaId,
                  areaName: area.areaName,
                  latitude: Number(area.latitude),
                  longitude: Number(area.longitude)
                }
              );
            });

            this.loadRoutes();
          },

          error: error => {
            console.error(
              'Failed to load area coordinates:',
              error
            );

            this.loadRoutes();
          }
        })
    );
  }

  private loadRoutes(): void {
    this.isLoadingRoutes = true;

    this.subscriptions.add(
      this.http
        .get<MlRoutesResponse>(
          `${this.mlApiUrl}/routes/p90`
        )
        .subscribe({
          next: response => {
            console.log(
              'EcoRoute AI P90 Routes:',
              response
            );

            this.routeMode =
              response.mode || 'P90 Safety Planning';

            this.routes =
              response.routes.map(
                (route, index) =>
                  this.mapMlRoute(route, index)
              );

            if (this.routes.length > 0) {
              this.selectedRouteId =
                this.routes[0].id;
            }

              this.isLoadingRoutes = false;

              this.loadRoadGeometry();
          },

          error: error => {
            console.error(
              'Failed to load P90 routes:',
              error
            );

            this.isLoadingRoutes = false;

            this.routes = [];
          }
        })
    );
  }

  // ============================================================
  // MAP API DATA TO EXISTING UI MODEL
  // ============================================================

  private mapMlRoute(
    route: MlRoute,
    index: number
  ): Route {

    const coordinates: [number, number][] =
      route.areas
        .map(area => {
          const location =
            this.areaLocations.get(area.area_id);

          if (!location) {
            return null;
          }

          return [
            location.latitude,
            location.longitude
          ] as [number, number];
        })
        .filter(
          (coordinate): coordinate is [number, number] =>
            coordinate !== null
        );

    const routeId =
      `#${String(index + 1).padStart(2, '0')}`;

    const sequence =
      route.areas.map(
        area => area.area_name
      );

    return {
      id: routeId,

      area: sequence.join(' → '),

      vehicle: route.vehicle_name,

      wasteLoad:
        `${this.formatKg(route.load_kg)}`,

      stops: route.areas.length,

      distance:
        `${route.distance_km.toFixed(2)} km`,

      status:
        route.distance_exceeded
          ? 'Pending'
          : 'Active',

      eta:
        this.formatTime(route.collection_end),

      estimatedTime:
        `${this.formatTime(route.collection_start)} to ${this.formatTime(route.collection_end)}`,

      predictedWaste:
        `${this.formatKg(route.load_kg)}`,

      sequence,

      color:
        this.routeColors[
          index % this.routeColors.length
        ],

      vehicleId: route.vehicle_id,

      capacityKg: route.capacity_kg,

      remainingCapacityKg:
        route.remaining_capacity_kg,

      maximumDistanceKm:
        route.maximum_distance_km,

      collectionStart:
        route.collection_start,

      collectionEnd:
        route.collection_end,

      roadAccessibility:
        route.road_accessibility,

      areaRestrictions:
        route.area_restrictions,

      areas: route.areas,

      coordinates
    };
  }

  // ============================================================
  // BUTTONS
  // ============================================================

  viewConstraints(): void {
    if (!this.selectedRoute) {
      return;
    }

    const route = this.selectedRoute;

    alert(
      'Route constraints:\n\n' +
      `Vehicle capacity: ${this.formatKg(route.capacityKg)}\n` +
      `Maximum route distance: ${route.maximumDistanceKm.toFixed(2)} km\n` +
      `Collection time: ${this.formatTime(route.collectionStart)} to ${this.formatTime(route.collectionEnd)}\n` +
      `Road accessibility: ${route.roadAccessibility}\n` +
      `Area restrictions: ${route.areaRestrictions}`
    );
  }

  optimizeRoutes(): void {
    if (this.isOptimizing) {
      return;
    }

    this.isOptimizing = true;

    this.subscriptions.add(
      this.http
        .get<MlRoutesResponse>(
          `${this.mlApiUrl}/routes/p90`
        )
        .subscribe({
          next: response => {
            this.routeMode =
              response.mode || 'P90 Safety Planning';

            this.routes =
              response.routes.map(
                (route, index) =>
                  this.mapMlRoute(route, index)
              );

            if (this.routes.length > 0) {
              const selectedStillExists =
                this.routes.some(
                  route =>
                    route.id === this.selectedRouteId
                );

              if (!selectedStillExists) {
                this.selectedRouteId =
                  this.routes[0].id;
              }
            }

            this.isOptimizing = false;

            this.loadRoadGeometry();

            alert(
              'Routes optimized successfully using P90 safety planning.'
            );
          },

          error: error => {
            console.error(
              'Route optimization failed:',
              error
            );

            this.isOptimizing = false;

            alert(
              'Route optimization failed. Please make sure the ML service and backend are running.'
            );
          }
        })
    );
  }

  reroute(): void {
    if (!this.selectedRoute) {
      return;
    }

    /*
     * EcoRoute AI does not currently support live traffic
     * rerouting. This recalculates the planned route using
     * the current static distance matrix and P90 predictions.
     */

    this.isOptimizing = true;

    this.subscriptions.add(
      this.http
        .get<MlRoutesResponse>(
          `${this.mlApiUrl}/routes/p90`
        )
        .subscribe({
          next: response => {
            this.routes =
              response.routes.map(
                (route, index) =>
                  this.mapMlRoute(route, index)
              );

            this.isOptimizing = false;

            this.loadRoadGeometry();

            alert(
              'The route plan was recalculated using the current P90 predictions and routing constraints.'
            );
          },

          error: error => {
            console.error(
              'Route recalculation failed:',
              error
            );

            this.isOptimizing = false;

            alert(
              'Route recalculation failed.'
            );
          }
        })
    );
  }

  applyChanges(): void {
    if (!this.selectedRoute) {
      return;
    }

    alert(
      `Route ${this.selectedRoute.id} changes applied.\n\n` +
      `Vehicle: ${this.selectedRoute.vehicle}\n` +
      `Load: ${this.selectedRoute.wasteLoad}\n` +
      `Distance: ${this.selectedRoute.distance}`
    );
  }

  // ============================================================
  // MAP
  // ============================================================

  private initializeMap(): void {
    this.map = L.map('routeMap', {
      zoomControl: false
    }).setView(
      [10.3573, 123.9160],
      13
    );

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; OpenStreetMap contributors'
      }
    ).addTo(this.map);

    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    this.routeLayerGroup =
      L.layerGroup().addTo(this.map);

    setTimeout(() => {
      this.refreshMap();
    }, 300);
  }

  private refreshMap(): void {
    if (!this.map || !this.routeLayerGroup) {
      return;
    }

    this.routeLayerGroup.clearLayers();

    if (!this.routes.length) {
      return;
    }

    const allCoordinates: [number, number][] = [];

    this.routes.forEach(route => {

      if (route.coordinates.length < 1) {
        return;
      }

      // Keep the actual collection area coordinates
      // for the markers and map bounds.
      allCoordinates.push(
        ...route.coordinates
      );

      // Use road geometry when available.
      // Fall back to the area coordinates if routing
      // has not returned geometry yet.
      const geometry =
        this.roadGeometry.get(route.id)
        ?? route.coordinates;

      if (geometry.length >= 2) {

        const polyline =
          L.polyline(
            geometry,
            {
              color: route.color,
              weight: 4,
              opacity: 0.9
            }
          );

        polyline.bindTooltip(
          `${route.id} — ${route.vehicle}`,
          {
            direction: 'top'
          }
        );

        this.routeLayerGroup.addLayer(
          polyline
        );
      }

      // Keep the numbered markers on the actual
      // collection area coordinates.
      route.coordinates.forEach(
        (coordinate, index) => {

          const area =
            route.areas[index];

          const marker =
            L.marker(
              coordinate,
              {
                icon:
                  this.createRouteNumberIcon(
                    route.color,
                    index + 1
                  )
              }
            );

          marker.bindTooltip(
            `${route.id} — Stop ${index + 1}<br>${area?.area_name ?? ''}`,
            {
              direction: 'top'
            }
          );

          this.routeLayerGroup.addLayer(
            marker
          );
        }
      );
    });

    if (allCoordinates.length > 0) {
      this.map.fitBounds(
        L.latLngBounds(
          allCoordinates
        ),
        {
          padding: [30, 30]
        }
      );
    }

    setTimeout(() => {
      this.map.invalidateSize();
    }, 100);
  }

  private createRouteNumberIcon(
    color: string,
    number: number
  ): L.DivIcon {

    return L.divIcon({
      className:
        'route-number-marker',

      html: `
        <div style="
          background:${color};
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
          ${number}
        </div>
      `,

      iconSize: [24, 24],

      iconAnchor: [12, 12]
    });
  }

  private focusRoute(route: Route): void {
    if (!this.map) {
      return;
    }

    if (!route.coordinates.length) {
      return;
    }

    this.map.fitBounds(
      L.latLngBounds(
        route.coordinates
      ),
      {
        padding: [30, 30]
      }
    );
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private formatKg(value: number): string {
    return `${Number(value).toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )} kg`;
  }

  private formatTime(value: string): string {
    if (!value) {
      return '--';
    }

    const parts = value.split(':');

    if (parts.length < 2) {
      return value;
    }

    const hour =
      Number(parts[0]);

    const minute =
      Number(parts[1]);

    const period =
      hour >= 12
        ? 'PM'
        : 'AM';

    const displayHour =
      hour % 12 || 12;

    return `${displayHour}:${String(
      minute
    ).padStart(2, '0')} ${period}`;
  }

  private parseNumber(
    value: string
  ): number {

    return Number(
      value.replace(
        /[^0-9.-]/g,
        ''
      )
    ) || 0;
  }

  private loadRoadGeometry(): void {
    if (!this.routes.length) {
      this.refreshMap();
      return;
    }

    let completed = 0;

    this.routes.forEach(route => {

      if (route.coordinates.length < 2) {
        completed++;

        if (completed === this.routes.length) {
          this.refreshMap();
        }

        return;
      }

      const coordinates =
        route.coordinates
          .map(
            ([latitude, longitude]) =>
              `${longitude},${latitude}`
          )
          .join(';');

      this.subscriptions.add(
        this.http
          .get<RoadRouteResponse>(
            `${this.mlApiUrl
              .replace('/ml', '')}/map/route`,
            {
              params: {
                coordinates
              }
            }
          )
          .subscribe({
            next: response => {

              if (
                response.code === 'Ok' &&
                response.routes.length > 0
              ) {

                const geometry =
                  response.routes[0]
                    .geometry
                    .coordinates;

                const leafletCoordinates:
                  [number, number][] =
                  geometry.map(
                    ([longitude, latitude]) =>
                      [
                        latitude,
                        longitude
                      ]
                  );

                this.roadGeometry.set(
                  route.id,
                  leafletCoordinates
                );
              }

              completed++;

              if (
                completed === this.routes.length
              ) {
                this.refreshMap();
              }
            },

            error: error => {

              console.error(
                `Road routing failed for ${route.id}:`,
                error
              );

              /*
              * Fall back to the area coordinates
              * if road routing fails.
              */

              this.roadGeometry.set(
                route.id,
                route.coordinates
              );

              completed++;

              if (
                completed === this.routes.length
              ) {
                this.refreshMap();
              }
            }
          })
      );
    });
  }
}