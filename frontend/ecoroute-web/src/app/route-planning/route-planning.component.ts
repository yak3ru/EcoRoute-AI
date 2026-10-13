import { environment } from '../../environments/environment';
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
import { Subscription, firstValueFrom } from 'rxjs';
import { AlertPopupComponent } from '../shared/alert-popup/alert-popup.component';

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
  route_number?: number;
  vehicle_id: number;
  vehicle_name: string;
  capacity_kg: number;
  status?: string;
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
  alternative_route_found?: boolean;
  operation_status?: string;
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
  status: 'Active' | 'Pending' | 'Completed' | 'Cancelled';
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

interface Vehicle {
  vehicleId: number;
  vehicleName: string;
  capacityKg: number;
  status: string;

  maximumRouteDistanceKm: number;
  collectionStartTime: string;
  collectionEndTime: string;
}

@Component({
  selector: 'app-route-planning',
  standalone: true,
  imports: [
  CommonModule,
  FormsModule,
  AlertPopupComponent
],
  templateUrl: './route-planning.component.html',
  styleUrl: './route-planning.component.scss'
})
export class RoutePlanningComponent
  implements OnInit, AfterViewInit, OnDestroy {

  systemDate = '';

  private roadGeometry = new Map<
    string,
    [number, number][]
  >();

  private http = inject(HttpClient);

  private readonly mlApiUrl =
  `${environment.apiUrl}/ml`;
  private readonly areasApiUrl = `${environment.apiUrl}/areas`;

  private subscriptions = new Subscription();

  private map!: L.Map;

  showAlertModal = false;

  private baseTileLayer?: L.TileLayer;

  private routeLayerGroup!: L.LayerGroup;

  private areaLocations = new Map<number, AreaLocation>();

  private mapBoundsInitialized = false;

  private unassignedAreas: unknown[] = [];

  selectedRouteId = '';
  private mapViewRouteId: string | null = null;

  operation_status?: string;

  showFinishConfirmation = false;
  routePendingFinish: Route | null = null;

  showCancelTruckConfirmation = false;
  routePendingCancel: Route | null = null;

  showAllRoutesCompletedModal = false;

  showCancelConfirmation = false;
  
  isOptimizing = false;
  isLoadingRoutes = true;
  isRoutePanelOpen = false;
  animateMapLayout = false;

  reportAlreadyUploaded = false;

  isStartingOperation = false;
  isHistoricalView = false;
  
historicalOperationStatus:
  'Active' | 'Completed' | 'Cancelled' | null = null;

operationStatus:
  | 'NotStarted'
  | 'Active'
  | 'Completed'
  | 'Cancelled' = 'NotStarted';

  searchTerm = '';

  isModifyInfoOpen = false;

  vehicles: Vehicle[] = [];

isAddTruckOpen = false;
isEditTruckOpen = false;
isDeleteTruckOpen = false;

selectedVehicle: Vehicle | null = null;

truckName = '';
truckCapacityKg: number | null = null;
truckMaximumRouteDistanceKm: number | null = null;
truckCollectionStartTime = '';
truckCollectionEndTime = '';
truckStatus = 'Available';

isSavingTruck = false;

  routeMode = 'P90 Safety Planning';

  routes: Route[] = [];
  private currentRouteResponse: MlRoutesResponse | null = null;
  selectedDate: Date = new Date(0);
  isCalendarOpen = false;

  availableOperationDates: string[] = [];

  calendarMonth: Date = new Date(0);

  calendarDays: {
    date: Date;
    dateNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isAvailable: boolean;
  }[] = [];

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
  this.http
    .get<{ currentDate: string }>(
      `${environment.apiUrl}/system/time`,
      {
        withCredentials: true
      }
    )
    .subscribe({
      next: (response) => {
        this.systemDate = response.currentDate;

        const [year, month, day] =
          this.systemDate.split('-').map(Number);

        const backendDate =
          new Date(year, month - 1, day);

        this.selectedDate = new Date(backendDate);
        this.calendarMonth = new Date(backendDate);

        this.loadAreasAndRoutes();
      },
      error: (error) => {
        console.error(
          'Failed to fetch system date:',
          error
        );
      }
    });
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
    this.routes
      .filter(route => route.status === 'Active')
      .map(route => route.vehicleId)
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
    return this.unassignedAreas.length > 0;
  }

  closeRoutePanel(): void {
    this.isRoutePanelOpen = false;
    this.animateMapLayout = true;

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  selectRoute(route: Route): void {
    this.selectedRouteId = route.id;
    this.isRoutePanelOpen = true;
    this.animateMapLayout = true;

    setTimeout(() => {
      this.focusRoute(route);
      this.map?.invalidateSize();
    }, 200);
  }

  viewRoute(route: Route): void {
    this.mapViewRouteId = route.id;
    this.selectRoute(route);
    this.refreshMap();
  }


  showAllRoutes(): void {
    this.mapViewRouteId = null;
    this.refreshMap();

    if (!this.map || !this.routes.length) {
      return;
    }

    const allCoordinates: [number, number][] = [];

    this.routes.forEach(route => {
      allCoordinates.push(...route.coordinates);
    });

    if (allCoordinates.length > 0) {
      this.map.fitBounds(
        L.latLngBounds(allCoordinates),
        {
          padding: [40, 40],
          maxZoom: 13,
          animate: true
        }
      );
    }
  }

  closeAllRoutesCompletedModal(): void {
    this.showAllRoutesCompletedModal = false;
  }

  goToReportUpload(): void {
    this.showAllRoutesCompletedModal = false;
    this.uploadReport();
  }

  private loadReportUploadStatus(date: string): void {
  this.reportAlreadyUploaded = false;

  this.subscriptions.add(
    this.http.get<{ operationDate: string; uploaded: boolean }>(
      `${environment.apiUrl}/Waste/report-upload-status`,
      {
        params: { operationDate: date }
      }
    ).subscribe({
      next: result => {
        // Only apply the response if the user is still viewing this date.
        if (this.toLocalDateString(this.selectedDate) === date) {
          this.reportAlreadyUploaded = result.uploaded;
        }
      },
      error: error => {
        console.error('Failed to check report upload status:', error);
        this.reportAlreadyUploaded = false;
      }
    })
  );
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

            this.loadCurrentOperation()
          },

          error: error => {
            console.error(
              'Failed to load area coordinates:',
              error
            );

            this.loadCurrentOperation()
          }
        })
    );
  }

  

private loadCurrentOperation(): void {
  const today = this.systemDate;

  const [year, month, day] = today.split('-').map(Number);
  this.selectedDate = new Date(year, month - 1, day);
  this.isHistoricalView = false;

  this.loadReportUploadStatus(today);

  this.subscriptions.add(
    this.http.get<{ status: string }>(
      `${this.mlApiUrl}/routes/operation/status/${today}`
    ).subscribe({
      next: result => {
        
    this.operationStatus =
  result.status === 'Cancelled'
    ? 'NotStarted'
    : result.status === 'Completed'
      ? 'Completed'
      : 'Active';

this.historicalOperationStatus = null;

const routeStatus =
  result.status === 'Cancelled'
    ? 'Cancelled'
    : this.operationStatus;

this.loadOperationRoutes(today, routeStatus);
      },
      error: error => {
        if (error.status === 404) {
          this.operationStatus = 'NotStarted';
          this.routes = [];
          this.currentRouteResponse = null;
          this.selectedRouteId = '';
          this.unassignedAreas = [];
          this.isLoadingRoutes = false;
          this.roadGeometry.clear();
          this.addBaseTiles();
          this.refreshMap();
          return;
        }

        console.error('Failed to load operation status:', error);
        this.isLoadingRoutes = false;
      }
    })
  );
}

private loadOperationRoutes(
  date: string,
  status:
  | 'NotStarted'
  | 'Active'
  | 'Completed'
  | 'Cancelled'
): void {
  this.isLoadingRoutes = true;
  this.roadGeometry.clear();

  this.subscriptions.add(
    this.http.get<MlRoutesResponse>(
      `${this.mlApiUrl}/routes/history/${date}`
    ).subscribe({
      next: response => {
        this.currentRouteResponse = response;
        this.routeMode = status === 'Completed'
          ? 'Historical Operation'
          : response.mode || 'P90 Safety Planning';

        this.unassignedAreas = response.unassigned ?? [];

        this.routes = response.routes.map((route, index) => {
        const mappedRoute = this.mapMlRoute(route, index);

        return {
        ...mappedRoute,
        status:
          status === 'Completed'
            ? 'Completed' as const
            : status === 'Cancelled'
              ? 'Cancelled' as const
              : mappedRoute.status
      };
      });

        this.selectedRouteId = this.routes[0]?.id ?? '';
        this.isLoadingRoutes = false;
        this.mapBoundsInitialized = false;

        this.loadRoadGeometry();
      },
      error: error => {
        console.error('Failed to load operation routes:', error);
        this.routes = [];
        this.selectedRouteId = '';
        this.isLoadingRoutes = false;
        this.addBaseTiles();
        this.refreshMap();
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

    const routeNumber = route.route_number ?? index + 1;
const routeId = `#${String(routeNumber).padStart(2, '0')}`;

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
      route.status === 'Cancelled'
        ? 'Cancelled'
        : route.status === 'Completed'
          ? 'Completed'
          : route.distance_exceeded
            ? 'Pending'
            : 'Active',

      eta:
        this.formatTime(route.collection_end),

      estimatedTime:
        `${this.formatTime(route.collection_start)} to ${this.formatTime(route.collection_end)}`,

      predictedWaste:
        `${this.formatKg(
          route.areas.reduce(
            (total, area) => total + Number(area.p50_kg || 0),
            0
          )
        )}`,

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

openModifyInfo(): void {
  this.isModifyInfoOpen = true;
  this.loadVehicles();
}

closeModifyInfo(): void {
  this.isModifyInfoOpen = false;
}

selectTruck(vehicle: Vehicle): void {
  if (this.selectedVehicle?.vehicleId === vehicle.vehicleId) {
    this.selectedVehicle = null;
    return;
  }

  this.selectedVehicle = vehicle;
}

formatTruckTime(time: string): string {
  if (!time) {
    return '';
  }

  const [hours, minutes] = time.split(':').map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

openAddTruck(): void {
  this.selectedVehicle = null;
  this.truckName = '';
  this.truckCapacityKg = null;
  this.truckMaximumRouteDistanceKm = null;
  this.truckCollectionStartTime = '';
  this.truckCollectionEndTime = '';
  this.truckStatus = 'Available';

  // Close Truck Management before opening Add Truck.
  this.isModifyInfoOpen = false;
  this.isAddTruckOpen = true;
}

saveAddTruck(): void {
  if (this.operationStatus === 'Active') {
    return;
  }

  if (!this.truckName.trim()) {
    this.showAlert('Please enter a truck name.');
    return;
  }

  if (!this.truckCapacityKg || this.truckCapacityKg <= 0) {
    this.showAlert('Please enter a valid truck capacity.');
    return;
  }

  if (
    !this.truckMaximumRouteDistanceKm ||
    this.truckMaximumRouteDistanceKm <= 0
  ) {
    this.showAlert('Please enter a valid maximum route distance.');
    return;
  }

  if (
    !this.truckCollectionStartTime ||
    !this.truckCollectionEndTime
  ) {
    this.showAlert('Please enter the collection start and end time.');
    return;
  }

  if (
    this.truckCollectionStartTime >=
    this.truckCollectionEndTime
  ) {
    this.showAlert('Collection end time must be later than the start time.');
    return;
  }

  this.isSavingTruck = true;

  const request = {
    vehicleName: this.truckName.trim(),
    capacityKg: this.truckCapacityKg,
    maximumRouteDistanceKm:
      this.truckMaximumRouteDistanceKm,
    collectionStartTime:
      this.truckCollectionStartTime,
    collectionEndTime:
      this.truckCollectionEndTime,
    status: this.truckStatus
  };

  this.subscriptions.add(
    this.http
      .post(
        `${environment.apiUrl}/Vehicles/with-constraints`,
        request
      )
      .subscribe({
next: () => {
  this.isSavingTruck = false;
  this.isAddTruckOpen = false;
  this.isModifyInfoOpen = true;

  this.loadVehicles();
  this.showAlert('Truck added successfully.');
},


        error: error => {
          console.error('Failed to add truck:', error);

          this.isSavingTruck = false;

          this.showAlert(
            error.error?.message ||
            'Failed to add truck. Please try again.'
          );
        }
      })
  );
}

closeAddTruck(): void {
  this.isAddTruckOpen = false;
  this.isModifyInfoOpen = true;
}

openEditTruck(vehicle: Vehicle): void {
  this.selectedVehicle = vehicle;

  this.truckName = vehicle.vehicleName;
  this.truckCapacityKg = vehicle.capacityKg;
  this.truckMaximumRouteDistanceKm =
    vehicle.maximumRouteDistanceKm;

  this.truckCollectionStartTime =
    vehicle.collectionStartTime.substring(0, 5);

  this.truckCollectionEndTime =
    vehicle.collectionEndTime.substring(0, 5);

  this.truckStatus = vehicle.status;

  // Close Truck Management before opening Edit Truck.
  this.isModifyInfoOpen = false;
  this.isEditTruckOpen = true;
}

closeEditTruck(): void {
  this.isEditTruckOpen = false;
  this.isModifyInfoOpen = true;
}

saveEditTruck(): void {
  if (!this.selectedVehicle) {
    return;
  }

  if (!this.truckName.trim()) {
    return;
  }

  if (!this.truckCapacityKg || this.truckCapacityKg <= 0) {
    return;
  }

  if (
    !this.truckMaximumRouteDistanceKm ||
    this.truckMaximumRouteDistanceKm <= 0
  ) {
    return;
  }

  if (
    !this.truckCollectionStartTime ||
    !this.truckCollectionEndTime
  ) {
    return;
  }

  if (
    this.truckCollectionStartTime >=
    this.truckCollectionEndTime
  ) {
    return;
  }

  this.isSavingTruck = true;
  this.alertMessage = 'Truck saved successfully.';

  const request = {
    vehicleName: this.truckName.trim(),
    capacityKg: this.truckCapacityKg,
    maximumRouteDistanceKm:
      this.truckMaximumRouteDistanceKm,
    collectionStartTime:
      this.truckCollectionStartTime,
    collectionEndTime:
      this.truckCollectionEndTime,
    status: this.truckStatus
  };

  this.subscriptions.add(
    this.http
      .put(
        `${environment.apiUrl}/Vehicles/${this.selectedVehicle.vehicleId}/with-constraints`,
        request
      )
      .subscribe({
        next: () => {
          this.isSavingTruck = false;
          this.isEditTruckOpen = false;
          this.loadVehicles();
        },
        error: error => {
          console.error('Failed to update truck:', error);
          this.isSavingTruck = false;
        }
      })
  );
}

openDeleteTruck(vehicle: Vehicle): void {
  this.selectedVehicle = vehicle;
  this.isDeleteTruckOpen = true;
}

closeDeleteTruck(): void {
  this.isDeleteTruckOpen = false;
}

deleteTruck(): void {
  if (this.operationStatus === 'Active') {
    return;
  }

  if (!this.selectedVehicle) {
    return;
  }

  this.isSavingTruck = true;

  this.subscriptions.add(
    this.http
      .delete(
        `${environment.apiUrl}/Vehicles/${this.selectedVehicle.vehicleId}`
      )
      .subscribe({
        next: () => {
          this.isSavingTruck = false;
          this.isDeleteTruckOpen = false;
          this.selectedVehicle = null;

          this.loadVehicles();

          this.showAlert('Truck deleted successfully.');
        },

        error: error => {
          console.error('Failed to delete truck:', error);

          this.isSavingTruck = false;

          this.showAlert(
            error.error?.message ||
            'Failed to delete truck. Please try again.'
          );
        }
      })
  );
}

private loadVehicles(): void {
  this.subscriptions.add(
    this.http
      .get<Vehicle[]>(`${environment.apiUrl}/Vehicles`)
      .subscribe({
        next: vehicles => {
          this.vehicles = vehicles;
        },
        error: error => {
          console.error('Failed to load vehicles:', error);
          this.vehicles = [];
        }
      })
  );
}


startOperation(): void {
  if (
    this.isStartingOperation ||
    this.isHistoricalView ||
    this.operationStatus === 'Active' ||
    this.operationStatus === 'Completed'
  ) {
    return;
  }

  this.isStartingOperation = true;
  this.isLoadingRoutes = true;

  this.subscriptions.add(
    this.http.post<MlRoutesResponse>(
      `${this.mlApiUrl}/routes/operation/start`,
      {}
    ).subscribe({
      next: response => {
        this.currentRouteResponse = response;
        this.operationStatus = 'Active';
        this.isHistoricalView = false;
        this.routeMode = response.mode || 'P90 Safety Planning';
        this.unassignedAreas = response.unassigned ?? [];

        this.routes = response.routes.map(
          (route, index) => this.mapMlRoute(route, index)
        );

        this.selectedRouteId = this.routes[0]?.id ?? '';
        this.mapBoundsInitialized = false;
        this.roadGeometry.clear();

        this.isStartingOperation = false;
        this.isLoadingRoutes = false;
        this.loadRoadGeometry();
        this.loadAvailableOperationDates();
      },
      error: error => {
        console.error('Failed to start operation:', error);
        this.isStartingOperation = false;
        this.isLoadingRoutes = false;
        this.showAlert(error.error?.message || 'Could not start the operation.');
      }
    })
  );
}

confirmCancelOperation(): void {
  if (this.operationStatus !== 'Active' || this.isHistoricalView) {
    this.showCancelConfirmation = false;
    return;
  }

  this.subscriptions.add(
    this.http.post(
      `${this.mlApiUrl}/routes/operation/cancel`,
      {}
    ).subscribe({
      next: () => {
        this.operationStatus = 'NotStarted';
        this.showCancelConfirmation = false;

        const today = this.systemDate;

        this.loadOperationRoutes(today, 'Cancelled');
        this.alertMessage = 'Operation Cancelled.';
      },
      error: error => {
        console.error('Failed to cancel operation:', error);

        this.showCancelConfirmation = false;

        this.showAlert(
          error.error?.message ||
          'Could not cancel the operation.'
        );
      }
    })
  );
}

cancelOperation(): void {
  if (
    this.operationStatus !== 'Active' ||
    this.isHistoricalView
  ) {
    return;
  }

  this.showCancelConfirmation = true;
}

closeCancelConfirmation(): void {
  this.showCancelConfirmation = false;
}

finishTruck(route: Route): void {
  if (
    this.operationStatus !== 'Active' ||
    this.isHistoricalView ||
    route.status === 'Completed'
  ) {
    return;
  }

  this.routePendingFinish = route;
  this.showFinishConfirmation = true;
}

cancelTruck(route: Route): void {
  if (
    this.operationStatus !== 'Active' ||
    this.isHistoricalView ||
    route.status !== 'Active'
  ) {
    return;
  }

  this.routePendingCancel = route;
  this.showCancelTruckConfirmation = true;
}

confirmCancelTruck(): void {
  const route = this.routePendingCancel;

  if (!route) {
    return;
  }

  this.showCancelTruckConfirmation = false;

  this.subscriptions.add(
    this.http
      .post<{
        message: string;
        status: string;
        routeData: MlRoutesResponse;
      }>(
        `${this.mlApiUrl}/routes/operation/cancel-truck`,
        {
          vehicleId: route.vehicleId
        }
      )
      .subscribe({
        next: response => {
          this.currentRouteResponse = response.routeData;

         this.operationStatus =
  response.status === 'Completed'
    ? 'Completed'
    : response.status === 'Cancelled'
      ? 'NotStarted'
      : 'Active';

          this.routes = response.routeData.routes.map(
            (mlRoute, index) =>
              this.mapMlRoute(mlRoute, index)
          );

          this.selectedRouteId =
            this.routes.find(
              item => item.vehicleId === route.vehicleId
            )?.id ?? this.routes[0]?.id ?? '';

          this.mapBoundsInitialized = false;
          this.roadGeometry.clear();

          this.loadRoadGeometry();
          this.loadAvailableOperationDates();

          if (response.status === 'Completed') {
  this.showAllRoutesCompletedModal = true;
}

          if (response.status === 'Cancelled') {
            this.alertMessage = 'Operation Cancelled.';
          }
        },

        error: error => {
          console.error(
            'Failed to cancel truck route:',
            error
          );

          this.showAlert(
            error.error?.message ||
            'Could not cancel this truck route. Please try again.'
          );
        }
      })
  );

  this.routePendingCancel = null;
}

closeCancelTruckConfirmation(): void {
  this.showCancelTruckConfirmation = false;
  this.routePendingCancel = null;
}

confirmFinishTruck(): void {
  const route = this.routePendingFinish;

  if (!route) {
    return;
  }

  this.showFinishConfirmation = false;

  this.subscriptions.add(
    this.http
      .post<{
        message: string;
        status: string;
        routeData: MlRoutesResponse;
      }>(
        `${this.mlApiUrl}/routes/operation/finish-truck`,
        { vehicleId: route.vehicleId }
      )
      .subscribe({
        next: response => {
          this.currentRouteResponse = response.routeData;

          this.operationStatus =
            response.status === 'Completed'
              ? 'Completed'
              : 'Active';

          this.routes = response.routeData.routes.map(
            (mlRoute, index) => this.mapMlRoute(mlRoute, index)
          );

          this.selectedRouteId =
            this.routes.find(
              item => item.vehicleId === route.vehicleId
            )?.id ?? this.routes[0]?.id ?? '';

          this.mapBoundsInitialized = false;
          this.roadGeometry.clear();

          this.loadRoadGeometry();
          this.loadAvailableOperationDates();

          if (response.status === 'Completed') {
  this.showAllRoutesCompletedModal = true;
}
        },
        error: error => {
          console.error('Failed to finish truck route:', error);

          this.showAlert(
            error.error?.message ||
            'Could not finish this truck route. Please try again.'
          );
        }
      })
  );

  this.routePendingFinish = null;
}

cancelFinishConfirmation(): void {
  this.showFinishConfirmation = false;
  this.routePendingFinish = null;
}


showUploadReportModal = false;
showImportSuccessModal = false;
importedRecordsCount = 0;
selectedReportFile: File | null = null;
isReportDragging = false;
isReportValidating = false;
reportValidationMessage = '';
reportValidationSuccess = false;

onReportFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    this.selectedReportFile = null;
    this.reportValidationSuccess = false;
    this.reportValidationMessage = 'Error: Invalid file type. Please select a CSV file.';
    input.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    this.selectedReportFile = null;
    this.reportValidationSuccess = false;
    this.reportValidationMessage = 'Error: File exceeds 10 MB size limit.';
    input.value = '';
    return;
  }

  this.selectedReportFile = file;
  this.reportValidationMessage = '';
  this.reportValidationSuccess = false;
  input.value = '';
}


async validateReportCsv(): Promise<void> {
  if (!this.selectedReportFile || this.isReportValidating) {
    return;
  }

  this.isReportValidating = true;
  this.reportValidationMessage = '';
  this.reportValidationSuccess = false;

  try {
    const content = (await this.selectedReportFile.text())
      .replace(/^\uFEFF/, '');

    const lines = content
      .split(/\r?\n/)
      .filter(line => line.trim() !== '');

    if (lines.length < 2) {
      this.reportValidationMessage =
        'Error: The CSV must contain a header and at least one data row.';
      return;
    }

    const headers = lines[0]
      .split(',')
      .map(header => header.trim().replace(/^"|"$/g, ''));

    const requiredHeaders = [
  'AreaName',
  'CollectionDate',
  'WasteType',
  'WeightKg',
  'Status'
];

    const missingHeaders = requiredHeaders.filter(
      header => !headers.includes(header)
    );

    if (missingHeaders.length > 0) {
      this.reportValidationMessage =
        `Error: Missing required columns: ${missingHeaders.join(', ')}`;
      return;
    }

    const columnIndex = (name: string) => headers.indexOf(name);

    const validWasteTypes = [
      'biodegradable',
      'non-biodegradable',
      'non biodegradable'
    ];

    const validStatuses = [
      'completed',
      'failed',
    ];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
        .split(',')
        .map(value => value.trim().replace(/^"|"$/g, ''));

      const rowNumber = i + 1;

      if (values.length !== headers.length) {
        this.reportValidationMessage =
          `Error: Row ${rowNumber} has an incorrect number of columns.`;
        return;
      }

      const areaName = values[columnIndex('AreaName')]?.trim();
      const collectionDate = values[columnIndex('CollectionDate')];
      const wasteType = values[columnIndex('WasteType')].toLowerCase();
      const weightKg = values[columnIndex('WeightKg')];
      const status = values[columnIndex('Status')].toLowerCase();

      if (!areaName) {
  this.reportValidationMessage =
    `Error: Row ${rowNumber} has a missing AreaName.`;
  return;
}

const normalizedAreaName = areaName
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const matchingArea = Array.from(this.areaLocations.values())
  .find(area =>
    area.areaName.toLowerCase().replace(/\s+/g, ' ').trim()
      === normalizedAreaName
  );

if (!matchingArea) {
  this.reportValidationMessage =
    `Error: Row ${rowNumber} has an unknown area name: "${areaName}". Check the spelling.`;
  return;
}

      if (!collectionDate ||
          Number.isNaN(Date.parse(collectionDate))) {
        this.reportValidationMessage =
          `Error: Row ${rowNumber} has an invalid CollectionDate.`;
        return;
      }

      if (!validWasteTypes.includes(wasteType)) {
        this.reportValidationMessage =
          `Error: Row ${rowNumber} has an invalid WasteType.`;
        return;
      }

      if (weightKg === '' ||
          !Number.isFinite(Number(weightKg)) ||
          Number(weightKg) < 0) {
        this.reportValidationMessage =
          `Error: Row ${rowNumber} has an invalid WeightKg.`;
        return;
      }

      if (!validStatuses.includes(status)) {
        this.reportValidationMessage =
          `Error: Row ${rowNumber} has an invalid Status.`;
        return;
      }
    }

    

const records = lines.slice(1).map(line => {
  const values = line
    .split(',')
    .map(value => value.trim().replace(/^"|"$/g, ''));

  const areaName = values[columnIndex('AreaName')].trim();
  const wasteType = values[columnIndex('WasteType')].toLowerCase();
  const status = values[columnIndex('Status')].toLowerCase();

  const normalizedAreaName = areaName
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const matchingArea = Array.from(this.areaLocations.values())
    .find(area =>
      area.areaName.toLowerCase().replace(/\s+/g, ' ').trim()
        === normalizedAreaName
    );

  if (!matchingArea) {
    throw new Error(
      `Area "${areaName}" was not found. Please check the spelling.`
    );
  }

  return {
    areaId: matchingArea.areaId,
    collectionDate: new Date(
      values[columnIndex('CollectionDate')]
    ).toISOString(),
    wasteType: wasteType === 'biodegradable'
      ? 'Biodegradable'
      : 'Non-biodegradable',
    weightKg: Number(values[columnIndex('WeightKg')]),
    status: status.charAt(0).toUpperCase() + status.slice(1)
  };
});


try {
  const operationDate = this.toLocalDateString(this.selectedDate);

const result = await firstValueFrom(
  this.http.post<{
    message: string;
    importedCount: number;
  }>(
    `${environment.apiUrl}/Waste/import?operationDate=${operationDate}`,
    records
  )
);

  this.reportAlreadyUploaded = true;
  this.importedRecordsCount = result.importedCount;

  // Close the upload modal
  this.showUploadReportModal = false;

  // Open the success modal
  this.showImportSuccessModal = true;
  this.reportValidationMessage =
    `Success: ${result.importedCount} records imported successfully.`;

  this.loadReportUploadStatus(operationDate);

} catch (error: any) {
  console.error('CSV import failed:', error);

  this.reportValidationSuccess = false;
  this.reportValidationMessage =
    error?.error?.message ||
    'Upload failed. Please check your connection and try again.';
}

  } catch {
    this.reportValidationMessage =
      'Unable to read this file. Please select a valid CSV file.';
  } finally {
    this.isReportValidating = false;
  }
}

onReportDragOver(event: DragEvent): void {
  event.preventDefault();
  this.isReportDragging = true;
}

onReportDragLeave(event: DragEvent): void {
  event.preventDefault();
  this.isReportDragging = false;
}

onReportFileDrop(event: DragEvent): void {
  event.preventDefault();
  this.isReportDragging = false;

  const file = event.dataTransfer?.files?.[0];

  if (file) {
    this.validateReportFile(file);
  }
}

private validateReportFile(file: File): void {
  if (
    !file.name.toLowerCase().endsWith('.csv') ||
    file.size > 10 * 1024 * 1024
  ) {
    this.selectedReportFile = null;
    this.reportValidationSuccess = false;
    this.reportValidationMessage = 'Error: Invalid file type. Please select a CSV file.';
    return;
  }

  this.selectedReportFile = file;
  this.reportValidationMessage = '';
  this.reportValidationSuccess = false;
}

uploadReport(): void {
  if (
    this.operationStatus !== 'Completed' ||
    this.reportAlreadyUploaded
  ) {
    return;
  }

  this.showUploadReportModal = true;
}

closeUploadReportModal(): void {
  this.showUploadReportModal = false;
  this.selectedReportFile = null;
  this.reportValidationMessage = '';
  this.reportValidationSuccess = false;
  this.isReportValidating = false;
  this.isReportDragging = false;
}

closeImportSuccessModal(): void {
  this.showImportSuccessModal = false;
}

toggleCalendar(): void {
  this.isCalendarOpen = !this.isCalendarOpen;

  if (this.isCalendarOpen) {
    this.calendarMonth = new Date(this.selectedDate);
    this.loadAvailableOperationDates();
  }
}

private loadAvailableOperationDates(): void {
  this.subscriptions.add(
    this.http
      .get<string[]>(`${this.mlApiUrl}/routes/history/dates`)
      .subscribe({
        next: dates => {
          this.availableOperationDates = dates;
          this.generateCalendarDays();
        },
        error: error => {
          console.error('Failed to load operation dates:', error);
          this.showAlert('Could not load operation history dates.');
        }
      })
  );
}

generateCalendarDays(): void {
  const year = this.calendarMonth.getFullYear();
  const month = this.calendarMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();

  const gridStart = new Date(year, month, 1 - startDay);

  this.calendarDays = [];

  const today = this.systemDate;

  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);

    const dateString = this.toLocalDateString(date);

    this.calendarDays.push({
      date,
      dateNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateString === today,
      isAvailable: this.availableOperationDates.includes(dateString)
    });
  }
}

previousCalendarMonth(): void {
  this.calendarMonth = new Date(
    this.calendarMonth.getFullYear(),
    this.calendarMonth.getMonth() - 1,
    1
  );

  this.generateCalendarDays();
}

nextCalendarMonth(): void {
  this.calendarMonth = new Date(
    this.calendarMonth.getFullYear(),
    this.calendarMonth.getMonth() + 1,
    1
  );

  this.generateCalendarDays();
}



selectOperationDate(date: Date): void {
  const dateString = this.toLocalDateString(date);
  const todayString = this.systemDate;

  if (
    dateString !== todayString &&
    !this.availableOperationDates.includes(dateString)
  ) {
    return;
  }

  this.selectedDate = new Date(date);
  this.isCalendarOpen = false;

  
if (dateString === todayString) {
  this.isHistoricalView = false;
  this.historicalOperationStatus = null;

  this.isRoutePanelOpen = false;
  this.animateMapLayout = true;

  this.loadCurrentOperation();

  setTimeout(() => {
    this.map?.invalidateSize({
      pan: false,
      animate: false
    });
  }, 350);

  return;
}

  this.isHistoricalView = true;

  this.loadReportUploadStatus(dateString);
  this.loadHistoricalRoutes(dateString);
}

toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

private loadHistoricalRoutes(date: string): void {
  this.isLoadingRoutes = true;
  this.roadGeometry.clear();

  this.subscriptions.add(
    this.http
      .get<MlRoutesResponse>(
        `${this.mlApiUrl}/routes/history/${date}?searchTerm=${encodeURIComponent(this.searchTerm.trim())}`
      )
      .subscribe({
        next: response => {
          const savedStatus = response.operation_status;

          // Display only Completed or Cancelled for old operations.
          this.historicalOperationStatus =
            savedStatus === 'Completed'
              ? 'Completed'
              : 'Cancelled';

          this.operationStatus =
            savedStatus === 'Completed'
              ? 'Completed'
              : savedStatus === 'Active'
                ? 'Active'
                : 'Cancelled';

          this.routeMode = 'Historical Operation';
          this.unassignedAreas = response.unassigned ?? [];

          this.routes = response.routes.map(
            (route, index) => {
              const mappedRoute = this.mapMlRoute(route, index);

              return {
                ...mappedRoute,
                status:
                  savedStatus === 'Completed'
                    ? 'Completed' as const
                    : mappedRoute.status
              };
            }
          );

          this.selectedRouteId = this.routes[0]?.id ?? '';
          this.isLoadingRoutes = false;
          this.mapBoundsInitialized = false;

          this.loadRoadGeometry();
        },
        error: error => {
          console.error(
            'Failed to load historical routes:',
            error
          );

          this.isLoadingRoutes = false;
          this.showAlert('Could not load routes for this date.');
        }
      })
  );
}
  
  optimizeRoutes(): void {
    if (this.isOptimizing) {
      return;
    }

    this.isOptimizing = true;
    this.roadGeometry.clear();

    this.subscriptions.add(
      this.http
        .get<MlRoutesResponse>(
          `${this.mlApiUrl}/routes/p90`
        )
        .subscribe({
          next: response => {
            this.currentRouteResponse = response;
            this.routeMode = response.mode || 'P90 Safety Planning';
            this.unassignedAreas = response.unassigned ?? [];

            this.routes = response.routes.map(
              (route, index) => this.mapMlRoute(route, index)
            );

            this.selectedRouteId = this.routes[0]?.id ?? '';
            this.mapBoundsInitialized = false;

            this.loadRoadGeometry();

            this.http
              .put(
                `${this.mlApiUrl}/routes/p90/save`,
                response
              )
              .subscribe({
                next: () => {
                  this.isOptimizing = false;
                  console.log('Optimized routes saved successfully.');
                  this.showAlert('Routes optimized and saved successfully.');
                },
                error: error => {
                  this.isOptimizing = false;
                  console.error('Failed to save optimized routes:', error);
                  this.showAlert('Routes were generated, but saving failed.');
                }
              });
          },
          error: error => {
            this.isOptimizing = false;
            console.error('Route optimization failed:', error);
            this.showAlert(
              'Route optimization failed. Please check that the backend and ML service are running.'
            );
          }
        })
    );
  }

  reroute(): void {
    if (!this.selectedRoute) {
      return;
    }

    const vehicleId =
      this.selectedRoute.vehicleId;

    this.isOptimizing = true;

    this.roadGeometry.clear();

    this.subscriptions.add(
      this.http
        .get<MlRoutesResponse>(
          `${this.mlApiUrl}/routes/p90/reroute/${vehicleId}`
        )
        .subscribe({
          next: response => {
            this.currentRouteResponse = response;

            this.routeMode =
              response.mode || 'P90 Reroute';

            this.unassignedAreas = response.unassigned ?? [];

            this.routes =
              response.routes.map(
                (route, index) =>
                  this.mapMlRoute(
                    route,
                    index
                  )
              );

            if (this.routes.length > 0) {

              const selectedStillExists =
                this.routes.some(
                  route =>
                    route.vehicleId === vehicleId
                );

              if (selectedStillExists) {

                const rerouted =
                  this.routes.find(
                    route =>
                      route.vehicleId === vehicleId
                  );

                if (rerouted) {
                  this.selectedRouteId =
                    rerouted.id;
                }

              } else {

                this.selectedRouteId =
                  this.routes[0].id;
              }
            }

            this.isOptimizing = false;

            this.loadRoadGeometry();

            if (response.alternative_route_found === false) {
              this.showAlert(
                'No alternative route was found for this truck. The current route is still displayed.'
              );
            } else {
              this.showAlert(
                'Reroute result loaded using the current P90 predictions, static road distances, and routing constraints.'
              );
            }
          },

          error: error => {

            console.error(
              'Route recalculation failed:',
              error
            );

            this.isOptimizing = false;

            this.showAlert(
              'Route recalculation failed. Please make sure the ML service and backend are running.'
            );
          }
        })
    );
  }

  
  applyChanges(): void {
    const route = this.selectedRoute;

    if (!route || !this.currentRouteResponse) {
      this.showAlert('There is no route plan to save. Please optimize routes first.');
      return;
    }

    this.subscriptions.add(
      this.http
        .put(
          `${this.mlApiUrl}/routes/p90/save`,
          this.currentRouteResponse
        )
        .subscribe({
          next: () => {
            this.showAlert(
              `Route ${route.id} changes saved successfully.\n\n` +
              `Vehicle: ${route.vehicle}\n` +
              `Load: ${route.wasteLoad}\n` +
              `Distance: ${route.distance}`
            );
          },
          error: error => {
            console.error('Failed to save route plan:', error);
            this.showAlert(
              'Could not save the route plan. Please check the backend and try again.'
            );
          }
        })
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

    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    this.routeLayerGroup =
      L.layerGroup().addTo(this.map);

    // Let the map container finish layout before Leaflet measures it.
    setTimeout(() => {
      if (!this.map) {
        return;
      }

      this.map.invalidateSize({ pan: false });

      if (this.routes.length) {
        this.refreshMap();
      } else if (!this.isLoadingRoutes) {
        this.addBaseTiles();
      }
    }, 150);
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

      const visibleRoutes = this.mapViewRouteId
        ? this.routes.filter(
            route => route.id === this.mapViewRouteId
          )
        : this.routes;

      visibleRoutes.forEach(route => {

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


    // SRP disposal destination marker
    const srpCoordinates: [number, number] = [
      10.2691059,
      123.8669431
    ];

    allCoordinates.push(srpCoordinates);

    const srpMarker = L.marker(
      srpCoordinates,
      {
        icon: L.divIcon({
          className: 'route-number-marker',
          html: `
            <div style="
              background: #dc2626;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 700;
              border: 2px solid white;
              box-shadow: 0 1px 5px rgba(0,0,0,.3);
            ">
              D
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }
    );

      srpMarker.bindTooltip(
        'SRP Disposal Destination',
        {
          direction: 'top'
        }
      );

      this.routeLayerGroup.addLayer(srpMarker);

      if (allCoordinates.length > 0) {
        const bounds = L.latLngBounds(allCoordinates);

        // Fit the initial view before requesting tiles, avoiding a burst of
        // tile requests at the default zoom that would immediately be canceled.
        if (!this.mapBoundsInitialized) {
          this.map.fitBounds(bounds, {
            padding: [30, 30],
            animate: false
          });

          this.mapBoundsInitialized = true;
        }
      }

      this.addBaseTiles();
  }



private addBaseTiles(): void {
  if (!this.map || this.baseTileLayer) {
    return;
  }

  const tileLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 3,
      attribution: '&copy; OpenStreetMap contributors'
    }
  );

  this.baseTileLayer = tileLayer;

  // Retry tile loading errors up to two times.
  tileLayer.on('tileerror', (event: L.TileErrorEvent) => {
    const tile = event.tile as HTMLImageElement;
    const retryCount = Number(
      tile.dataset['retryCount'] ?? '0'
    );

    if (retryCount >= 2) {
      return;
    }

    tile.dataset['retryCount'] = String(retryCount + 1);

    window.setTimeout(() => {
      if (this.map && this.map.hasLayer(tileLayer)) {
        tileLayer.redraw();
      }
    }, 1000 * (retryCount + 1));
  });

  tileLayer.addTo(this.map);
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
      this.addBaseTiles();
      this.refreshMap();
      return;
    }

    const srpCoordinates: [number, number] = [
      10.2691059,
      123.8669431
    ];

    // Show markers and fallback lines immediately while road geometry loads.
    this.refreshMap();

    this.routes.forEach(route => {
      if (route.coordinates.length < 2) {
        this.roadGeometry.set(route.id, route.coordinates);
        return;
      }

      // Include SRP as the final waypoint for every truck route.
      const routeCoordinates: [number, number][] = [
        ...route.coordinates,
        srpCoordinates
      ];

      const coordinates = routeCoordinates
        .map(([latitude, longitude]) => `${longitude},${latitude}`)
        .join(';');

      this.subscriptions.add(
        this.http
          .get<RoadRouteResponse>(
            `${this.mlApiUrl.replace('/ml', '')}/map/route`,
            { params: { coordinates } }
          )
          .subscribe({
            next: response => {
              const geometry = response?.routes?.[0]?.geometry?.coordinates;

              if (response?.code === 'Ok' && geometry?.length) {
                const leafletCoordinates: [number, number][] = geometry.map(
                  ([longitude, latitude]) => [latitude, longitude]
                );

                this.roadGeometry.set(route.id, leafletCoordinates);
              } else {
                // Keep a visible fallback line if the routing service returns no path.
                this.roadGeometry.set(route.id, routeCoordinates);
              }

              // Redraw only vector layers; do not refit the map on every response.
              this.refreshMap();
            },
            error: error => {
              console.error(`Road routing failed for ${route.id}:`, error);
              this.roadGeometry.set(route.id, routeCoordinates);
              this.refreshMap();
            }
          })
      );
    });
  }


downloadReportTemplate(): void {
  const csvContent = [
    'AreaName,CollectionDate,WasteType,WeightKg,Status',
    'Example Area,2026-10-13,Biodegradable,100.00,Completed',
    'Example Area,2026-10-13,Non-biodegradable,50.00,Completed'
  ].join('\r\n');

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'ecoroute-report-template.csv';
  link.click();

  URL.revokeObjectURL(url);
}


alertMessage = '';

showAlert(message: string): void {
  this.alertMessage = '';

  setTimeout(() => {
    this.alertMessage = message;
  }, 0);
}




}
