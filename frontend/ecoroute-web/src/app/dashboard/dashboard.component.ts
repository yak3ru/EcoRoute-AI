import {
  AfterViewInit,
  Component,
  OnDestroy,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Chart } from 'chart.js/auto';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit, OnDestroy {

  currentDate = '';

  // DASHBOARD MAP ROUTES

  private dashboardRoutes: any[] = [];

  private readonly areasApiUrl =
    'http://localhost:5276/api/areas';

  private readonly routeColors = [
    '#0a8f3d',
    '#1675d1',
    '#f7941d',
    '#ed2424',
    '#8b5cf6',
    '#0891b2',
    '#e11d48',
    '#65a30d'
  ];

  private readonly srpCoordinates: [number, number] = [
    10.2691059,
    123.8669431
  ];

  private areaLocations = new Map<
    number,
    { latitude: number; longitude: number }
  >();

  private roadGeometry = new Map<
    number,
    [number, number][]
  >();

  predictionLevel = '';

  predictionInsight = '';

  predictionAction = '';

  predictionTarget = '';

  aiPredictedWaste = 0;

  aiNormalWaste = 0;

  aiPredictionChange = 0;

  chartStartDate = this.getStartOfChartPeriod();

  chartDays: {
    date: Date;
    label: string;
    dateLabel: string;
    wasteKg: number | null;
    status: string;
  }[] = [];

  private readonly mlApiUrl =
    'http://localhost:5276/api/ml';

  private readonly wasteApiUrl =
    'http://localhost:5276/api/Waste';

  private http = inject(HttpClient);

  private subscriptions = new Subscription();

  private wasteChart?: Chart;

  private map?: L.Map;

  private routeLayer?: L.LayerGroup;

  // DASHBOARD SUMMARY DATA

  dashboardMode: 'current' | 'previous' = 'previous';

  wasteValue = 0;

  predictedWasteValue = 0;

  routeCount = 0;

  vehicleCount = 0;

  totalVehicles = 0;

  wasteChange = 0;

  predictionChange = 0;

  hasWasteData = false;

  previousOperationDate = '';

  mapOperationDate = '';

  isMapExpanded = false;

  ngOnInit(): void {

    this.currentDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    this.loadAreaLocations();
    this.loadDashboardData();

  }

  // ============================================================
  // DASHBOARD DATA
  // ============================================================

  private loadDashboardData(): void {

    const today = this.toLocalDateString(new Date());

    this.subscriptions.add(
      this.http
        .get<{ status: string }>(
          `${this.mlApiUrl}/routes/operation/status/${today}`
        )
        .subscribe({
          next: () => {

            // An operation exists for today.

            this.dashboardMode = 'current';

            this.loadCurrentOperation(today);

          },

          error: error => {

            if (error.status === 404) {

              this.dashboardMode = 'previous';

              this.loadPreviousOperation();

              this.loadPredictionForDate(today);

              return;

            }

            console.error(
              'Failed to load dashboard operation status:',
              error
            );

            this.dashboardMode = 'previous';

            this.loadPreviousOperation();

            this.loadPredictionForDate(today);

          }

        })

    );

  }

  private loadPredictionForDate(targetDate: string): void {

    this.subscriptions.add(
      this.http
        .get<any>(
          `${this.mlApiUrl}/predictions?targetDate=${targetDate}`
        )
        .subscribe({
          next: response => {

            this.predictionTarget =
              targetDate === this.toLocalDateString(new Date())
                ? 'today'
                : 'tomorrow';

            const predictions =
              response?.predictions ?? [];

            this.aiPredictedWaste =
              predictions.reduce(
                (total: number, prediction: any) =>
                  total +
                  Number(prediction.P50Kg || 0),
                0
              );

            this.aiPredictedWaste =
              Math.round(
                this.aiPredictedWaste * 100
              ) / 100;

            console.log(
              'Prediction target:',
              targetDate
            );

            console.log(
              'Predicted waste:',
              this.aiPredictedWaste
            );

            this.loadNormalWasteBaseline();

          },

          error: error => {

            console.error(
              'Failed to load prediction:',
              error
            );

            this.aiPredictedWaste = 0;

            this.aiNormalWaste = 0;

            this.aiPredictionChange = 0;

            this.predictionLevel = '';

            this.predictionInsight = '';

            this.predictionAction = '';

          }

        })
    );

  }

  private loadNormalWasteBaseline(): void {

    const today = this.toLocalDateString(new Date());

    console.log('Starting normal waste baseline...');

    console.log('Today:', today);

    // Look back 30 days for actual waste records

    const startDate = new Date();

    startDate.setDate(startDate.getDate() - 30);

    const startDateString =
      this.toLocalDateString(startDate);

    this.subscriptions.add(
      this.http
        .get<any[]>(
          `${this.wasteApiUrl}?startDate=${startDateString}&endDate=${today}`
        )
        .subscribe({
          next: records => {

            console.log(
              'Historical waste records:',
              records
            );

            if (!records || records.length === 0) {

              console.log(
                'No historical waste records found.'
              );

              this.aiNormalWaste = 0;

              this.calculatePredictionInsight();

              return;

            }

            // Group waste by collection date

            const dailyWaste = new Map<string, number>();

            records.forEach(record => {

              const recordDate =
                new Date(record.collectionDate);

              const date =
                this.toLocalDateString(recordDate);

              // Do not include today

              if (date >= today) {

                return;

              }

              const weight =
                Number(record.weightKg || 0);

              dailyWaste.set(
                date,
                (dailyWaste.get(date) || 0) + weight
              );

            });

            console.log(
              'Daily historical waste:',
              dailyWaste
            );

            // Get the most recent 7 days
            // that actually have waste records

            const validDays =
              Array.from(dailyWaste.entries())
                .sort((a, b) =>
                  b[0].localeCompare(a[0])
                )
                .slice(0, 7);

            console.log(
              'Valid historical waste days:',
              validDays
            );

            if (validDays.length === 0) {

              this.aiNormalWaste = 0;

            } else {

              const totalWaste =
                validDays.reduce(
                  (total, [, waste]) =>
                    total + waste,
                  0
                );

              this.aiNormalWaste =
                totalWaste / validDays.length;

            }

            this.aiNormalWaste =
              Math.round(
                this.aiNormalWaste * 100
              ) / 100;

            console.log(
              'Normal historical waste:',
              this.aiNormalWaste
            );

            this.calculatePredictionInsight();

          },

          error: error => {

            console.error(
              'Historical waste request failed:',
              error
            );

            this.aiNormalWaste = 0;

            this.calculatePredictionInsight();

          }

        })
    );

  }

  private calculatePredictionInsight(): void {

    if (this.aiNormalWaste <= 0) {

      this.aiPredictionChange = 0;

      this.predictionLevel = '';

      this.predictionInsight = '';

      this.predictionAction = '';

      return;

    }

    this.aiPredictionChange =
      (
        (this.aiPredictedWaste - this.aiNormalWaste) /
        this.aiNormalWaste
      ) *
      100;

    this.aiPredictionChange =
      Math.round(
        this.aiPredictionChange * 100
      ) / 100;

    if (this.aiPredictionChange >= 20) {

      this.predictionLevel =
        'Much higher than normal';

      this.predictionInsight =
        'High waste generation expected';

      this.predictionAction =
        'Prepare additional collection capacity';

    } else if (this.aiPredictionChange >= 5) {

      this.predictionLevel =
        'Slightly higher';

      this.predictionInsight =
        'Waste generation expected to increase';

      this.predictionAction =
        'Prepare for increased waste volume';

    } else if (this.aiPredictionChange >= -5) {

      this.predictionLevel =
        'Around normal';

      this.predictionInsight =
        'Waste generation expected to remain normal';

      this.predictionAction =
        'Proceed with the planned collection capacity';

    } else {

      this.predictionLevel =
        'Lower than normal';

      this.predictionInsight =
        'Waste generation expected to decrease';

      this.predictionAction =
        'Adjust collection capacity accordingly';

    }

  }

  private loadCurrentOperation(date: string): void {

    this.subscriptions.add(
      this.http
        .get<any>(
          `${this.mlApiUrl}/routes/history/${date}`
        )
        .subscribe({
          next: response => {

            this.applyOperationData(response);

            this.dashboardRoutes =
              response?.routes ?? [];

            this.mapOperationDate = date;

            this.loadActualWaste(date);

            this.updateCollectionMap();

          },

          error: error => {

            console.error(
              'Failed to load current operation:',
              error
            );

          }

        })
    );

  }

  private loadPreviousOperation(): void {

    this.subscriptions.add(
      this.http
        .get<string[]>(
          `${this.mlApiUrl}/routes/history/dates`
        )
        .subscribe({
          next: dates => {

            const today =
              this.toLocalDateString(new Date());

            const previousDate = dates
              .filter(date => date !== today)
              .sort()
              .reverse()[0];

            if (!previousDate) {

              this.clearDashboardData();

              return;

            }

            this.previousOperationDate =
              previousDate;

            this.mapOperationDate =
              previousDate;

            this.subscriptions.add(
              this.http
                .get<any>(
                  `${this.mlApiUrl}/routes/history/${previousDate}`
                )
                .subscribe({
                  next: response => {

                    this.applyOperationData(response);

                    this.dashboardRoutes =
                      response?.routes ?? [];

                    this.loadActualWaste(previousDate, false);

                    this.updateCollectionMap();

                  },

                  error: error => {

                    console.error(
                      'Failed to load previous operation:',
                      error
                    );

                    this.clearDashboardData();

                  }

                })
            );

          },

          error: error => {

            console.error(
              'Failed to load operation history dates:',
              error
            );

            this.clearDashboardData();

          }

        })
    );

  }

  private applyOperationData(response: any): void {

    const routes =
      response?.routes ?? [];

    this.routeCount =
      routes.length;

    this.vehicleCount =
      new Set(
        routes
          .map((route: any) => route.vehicle_id)
          .filter(
            (vehicleId: any) =>
              vehicleId !== null &&
              vehicleId !== undefined
          )
      ).size;

    this.predictedWasteValue =
      routes.reduce(
        (total: number, route: any) =>
          total +
          Number(route.load_kg || 0),
        0
      );

    this.predictedWasteValue =
      Math.round(
        this.predictedWasteValue * 100
      ) / 100;

  }

  private loadActualWaste(
  date: string,
  predictNextDay: boolean = true
): void {

  this.subscriptions.add(
    this.http
      .get<any[]>(
        `${this.wasteApiUrl}?startDate=${date}&endDate=${date}`
      )
      .subscribe({
        next: records => {

          this.wasteValue =
            records.reduce(
              (total, record) =>
                total +
                Number(record.weightKg || 0),
              0
            );

          this.wasteValue =
            Math.round(
              this.wasteValue * 100
            ) / 100;

          this.hasWasteData =
            records.length > 0;

          /*
           * Only determine the next prediction
           * when this is the CURRENT operation.
           *
           * Previous operation:
           * → do NOT change today's prediction
           *
           * Current operation with CSV:
           * → predict tomorrow
           *
           * Current operation without CSV:
           * → predict today
           */

          if (!predictNextDay) {

            return;

          }

          if (this.hasWasteData) {

            const tomorrow =
              new Date();

            tomorrow.setDate(
              tomorrow.getDate() + 1
            );

            const tomorrowString =
              this.toLocalDateString(
                tomorrow
              );

            console.log(
              'CSV uploaded.'
            );

            console.log(
              'Predicting tomorrow:',
              tomorrowString
            );

            this.loadPredictionForDate(
              tomorrowString
            );

          } else {

            console.log(
              'No CSV uploaded.'
            );

            console.log(
              'Predicting today:',
              date
            );

            this.loadPredictionForDate(
              date
            );

          }

        },

        error: error => {

          console.error(
            'Failed to load actual waste:',
            error
          );

          this.wasteValue = 0;

          this.hasWasteData = false;

          /*
           * Only load a prediction if this is
           * the current operation.
           */

          if (!predictNextDay) {

            return;

          }

          // No CSV means we are still
          // predicting today's waste.

          this.loadPredictionForDate(
            date
          );

        }

      })
  );

}

  private clearDashboardData(): void {

    this.wasteValue = 0;

    this.predictedWasteValue = 0;

    this.routeCount = 0;

    this.vehicleCount = 0;

    this.totalVehicles = 0;

    this.hasWasteData = false;

  }

  private toLocalDateString(date: Date): string {

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        date.getDate()
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;

  }

  get wasteDisplay(): string {

    return `${(
      this.wasteValue / 1000
    ).toFixed(1)} tons`;

  }

  get predictedWasteDisplay(): string {

    return `${(
      this.predictedWasteValue / 1000
    ).toFixed(1)} tons`;

  }

  // MAP SIZE

  toggleMapSize(): void {

    this.isMapExpanded =
      !this.isMapExpanded;

    setTimeout(() => {

      this.map?.invalidateSize();

    }, 500);

  }

  ngAfterViewInit(): void {

    this.createWasteChart();

    this.createCollectionMap();

    if (this.mapOperationDate) {

      this.updateCollectionMap();

    }

    this.loadCollectionHistory();

  }

  // WASTE CHART

  private createWasteChart(): void {

    const canvas =
      document.getElementById(
        'wasteChart'
      ) as HTMLCanvasElement | null;

    if (!canvas) {

      return;

    }

    this.wasteChart =
      new Chart(
        canvas,
        {
          type: 'bar',

          data: {
            labels: [],

            datasets: [
              {
                data: [],

                backgroundColor: '#0b9435',

                borderColor: '#0b9435',

                borderWidth: 0,

                borderRadius: 7,

                borderSkipped: false,

                barPercentage: 0.55,

                categoryPercentage: 0.7
              }
            ]
          },

          options: {

            responsive: true,

            maintainAspectRatio: false,

            // NO ANIMATION

            animation: {
              duration: 0
            },

            plugins: {

              legend: {
                display: false
              },

              tooltip: {

                callbacks: {

                  label: (context) => {

                    const day =
                      this.chartDays[
                        context.dataIndex
                      ];

                    if (
                      !day ||
                      day.wasteKg === null
                    ) {

                      return (
                        day?.status ||
                        'No operation'
                      );

                    }

                    return `${day.wasteKg.toLocaleString()} kg`;

                  }

                }

              }

            },

            scales: {

              y: {

                beginAtZero: true,

                max: 15000,

                ticks: {

                  stepSize: 5000,

                  callback: (value) => {

                    return `${Number(value) / 1000}k`;

                  }

                },

                title: {

                  display: true,

                  text: 'KG'

                },

                grid: {

                  color: '#e5e7eb'

                }

              },

              x: {

                grid: {

                  color: '#e5e7eb'

                },

                ticks: {

                  padding: 6

                }

              }

            }

          }

        }
      );

  }

  private loadCollectionHistory(): void {

    const startDate =
      new Date(this.chartStartDate);

    const endDate =
      new Date(startDate);

    endDate.setDate(
      startDate.getDate() + 6
    );

    this.subscriptions.add(
      this.http
        .get<string[]>(
          `${this.mlApiUrl}/routes/history/dates`
        )
        .subscribe({
          next: operationDates => {

            this.loadCollectionHistoryData(
              startDate,
              endDate,
              operationDates
            );

          },

          error: (error: any) => {

            console.error(
              'Failed to load operation history dates:',
              error
            );

            this.buildEmptyChart(startDate);

          }

        })
    );

  }

  private loadCollectionHistoryData(
    startDate: Date,
    endDate: Date,
    operationDates: string[]
  ): void {

    const dates: Date[] = [];

    for (let i = 0; i < 7; i++) {

      const date =
        new Date(startDate);

      date.setDate(
        startDate.getDate() + i
      );

      dates.push(date);

    }

    const startDateString =
      this.toLocalDateString(startDate);

    const endDateWithTime =
      new Date(endDate);

    endDateWithTime.setHours(
      23,
      59,
      59,
      999
    );

    const endDateString =
      this.toLocalDateTimeString(
        endDateWithTime
      );

    this.subscriptions.add(
      this.http
        .get<any[]>(
          `${this.wasteApiUrl}?startDate=${startDateString}&endDate=${endDateString}`
        )
        .subscribe({
          next: wasteRecords => {

            this.chartDays =
              dates.map(date => {

                const dateString =
                  this.toLocalDateString(date);

                const hasOperation =
                  operationDates.includes(
                    dateString
                  );

                const recordsForDay =
                  wasteRecords.filter(
                    record => {

                      const recordDate =
                        new Date(
                          record.collectionDate
                        );

                      return (
                        this.toLocalDateString(
                          recordDate
                        ) === dateString
                      );

                    }
                  );

                const wasteKg =
                  recordsForDay.length > 0
                    ? recordsForDay.reduce(
                        (
                          total,
                          record
                        ) =>
                          total +
                          Number(
                            record.weightKg || 0
                          ),
                        0
                      )
                    : null;

                let status =
                  'No operation';

                if (
                  hasOperation &&
                  wasteKg !== null
                ) {

                  status =
                    'Waste collected';

                }
                else if (hasOperation) {

                  status =
                    'Operation active or report pending';

                }

                return {

                  date,

                  label:
                    date.toLocaleDateString(
                      'en-US',
                      {
                        weekday: 'short'
                      }
                    ),

                  dateLabel:
                    date.toLocaleDateString(
                      'en-US',
                      {
                        month: 'short',
                        day: 'numeric'
                      }
                    ),

                  wasteKg,

                  status

                };

              });

            this.updateWasteChart();

          },

          error: (error: any) => {

            console.error(
              'Failed to load waste collection history:',
              error
            );

            this.buildEmptyChart(startDate);

          }

        })
    );

  }

  private updateWasteChart(): void {

    if (!this.wasteChart) {

      return;

    }

    this.wasteChart.data.labels =
      this.chartDays.map(day => [
        day.label,
        day.dateLabel
      ]);

    this.wasteChart.data.datasets[0].data =
      this.chartDays.map(
        day => day.wasteKg
      );

    this.wasteChart.update();

  }

  private buildEmptyChart(
    startDate: Date
  ): void {

    const dates: Date[] = [];

    for (let i = 0; i < 7; i++) {

      const date =
        new Date(startDate);

      date.setDate(
        startDate.getDate() + i
      );

      dates.push(date);

    }

    this.chartDays =
      dates.map(
        date => ({

          date,

          label:
            date.toLocaleDateString(
              'en-US',
              {
                weekday: 'short'
              }
            ),

          dateLabel:
            date.toLocaleDateString(
              'en-US',
              {
                month: 'short',
                day: 'numeric'
              }
            ),

          wasteKg: null,

          status: 'No operation'

        })
      );

    this.updateWasteChart();

  }

  previousChartPeriod(): void {

    this.chartStartDate =
      new Date(this.chartStartDate);

    this.chartStartDate.setDate(
      this.chartStartDate.getDate() - 7
    );

    this.loadCollectionHistory();

  }

  nextChartPeriod(): void {

    const nextStartDate =
      new Date(this.chartStartDate);

    nextStartDate.setDate(
      nextStartDate.getDate() + 7
    );

    const today =
      new Date();

    today.setHours(
      23,
      59,
      59,
      999
    );

    const nextEndDate =
      new Date(nextStartDate);

    nextEndDate.setDate(
      nextEndDate.getDate() + 6
    );

    if (nextEndDate > today) {

      return;

    }

    this.chartStartDate =
      nextStartDate;

    this.loadCollectionHistory();

  }

  private toLocalDateTimeString(
    date: Date
  ): string {

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        date.getDate()
      ).padStart(2, '0');

    const hours =
      String(
        date.getHours()
      ).padStart(2, '0');

    const minutes =
      String(
        date.getMinutes()
      ).padStart(2, '0');

    const seconds =
      String(
        date.getSeconds()
      ).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

  }

  private getStartOfChartPeriod(): Date {

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const start =
      new Date(today);

    start.setDate(
      today.getDate() - 6
    );

    return start;

  }

  // COLLECTION MAP

  private loadAreaLocations(): void {

    this.subscriptions.add(
      this.http
        .get<any[]>(this.areasApiUrl)
        .subscribe({

          next: areas => {

            this.areaLocations.clear();

            areas.forEach(area => {

              const areaId =
                Number(
                  area?.areaId ??
                  area?.AreaId
                );

              const latitude =
                Number(
                  area?.latitude ??
                  area?.Latitude
                );

              const longitude =
                Number(
                  area?.longitude ??
                  area?.Longitude
                );

              if (
                Number.isFinite(areaId) &&
                Number.isFinite(latitude) &&
                Number.isFinite(longitude)
              ) {

                this.areaLocations.set(
                  areaId,
                  {
                    latitude,
                    longitude
                  }
                );

              }

            });

            if (
              this.map &&
              this.dashboardRoutes.length
            ) {

              this.updateCollectionMap();

            }

          },

          error: error => {

            console.error(
              'Failed to load area coordinates:',
              error
            );

          }

        })
    );

  }

  private createCollectionMap(): void {

    const mapElement =
      document.getElementById(
        'collectionMap'
      );

    if (!mapElement) {

      return;

    }

    this.map =
      L.map(
        mapElement,
        {
          zoomControl: false
        }
      ).setView(
        [10.3573, 123.9160],
        13
      );

    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    this.routeLayer =
      L.layerGroup().addTo(this.map);

    this.addBaseTiles();

    setTimeout(() => {

      if (!this.map) {

        return;

      }

      this.map.invalidateSize({
        pan: false
      });

      if (
        this.dashboardRoutes.length &&
        this.areaLocations.size
      ) {

        this.updateCollectionMap();

      }

    }, 150);

  }

  private addBaseTiles(): void {

    if (!this.map) {

      return;

    }

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 3,
        attribution:
          '&copy; OpenStreetMap contributors'
      }
    ).addTo(this.map);

  }

  private updateCollectionMap(): void {

    if (!this.map || !this.routeLayer) {

      return;

    }

    this.routeLayer.clearLayers();

    this.roadGeometry.clear();

    if (!this.dashboardRoutes.length) {

      return;

    }

    const allCoordinates:
      [number, number][] = [];

    this.dashboardRoutes.forEach(
      (route: any, routeIndex: number) => {

        const areas =
          route?.areas ?? [];

        const coordinates:
          [number, number][] =
          areas
            .map(
              (
                area: any
              ): [number, number] | null => {

                const areaId =
                  Number(
                    area?.area_id ??
                    area?.AreaId
                  );

                const location =
                  this.areaLocations.get(
                    areaId
                  );

                if (!location) {

                  return null;

                }

                return [
                  location.latitude,
                  location.longitude
                ];

              }
            )
            .filter(
              (
                coordinate:
                  [number, number] | null
              ): coordinate is [number, number] =>
                coordinate !== null
            );

        if (!coordinates.length) {

          return;

        }

        allCoordinates.push(
          ...coordinates
        );

        const color =
          this.routeColors[
            routeIndex %
            this.routeColors.length
          ] ?? '#0a8f3d';

        this.drawDashboardRoute(
          route,
          routeIndex,
          coordinates,
          color
        );

      }
    );

    // Include the same SRP destination used by Route Planning
    // for the map extent and road routing.

    allCoordinates.push(
      this.srpCoordinates
    );

    if (allCoordinates.length) {

      this.map.fitBounds(
        L.latLngBounds(
          allCoordinates
        ),
        {
          padding: [30, 30],
          animate: false
        }
      );

    }

    this.loadRoadGeometry();

  }

  private drawDashboardRoute(
    route: any,
    routeIndex: number,
    coordinates: [number, number][],
    color: string
  ): void {

    if (!this.routeLayer) {

      return;

    }

    // Draw a fallback line immediately while the road geometry loads.

    if (coordinates.length >= 2) {

      const polyline =
        L.polyline(
          coordinates,
          {
            color,
            weight: 4,
            opacity: 0.9
          }
        );

      polyline.bindTooltip(
        `#${String(routeIndex + 1).padStart(2, '0')} — ${route?.vehicle_name ?? ''}`,
        {
          direction: 'top'
        }
      );

      this.routeLayer.addLayer(
        polyline
      );

    }

    // Use the same numbered circular markers as Route Planning.

    coordinates.forEach(
      (
        coordinate: [number, number],
        index: number
      ) => {

        const area =
          route?.areas?.[index];

        const marker =
          L.marker(
            coordinate,
            {
              icon:
                this.createRouteNumberIcon(
                  color,
                  index + 1
                )
            }
          );

        marker.bindTooltip(
          `#${String(routeIndex + 1).padStart(2, '0')} — Stop ${index + 1}<br>${area?.area_name ?? ''}`,
          {
            direction: 'top'
          }
        );

        this.routeLayer!.addLayer(
          marker
        );

      }
    );

  }

  private loadRoadGeometry(): void {

    if (
      !this.map ||
      !this.dashboardRoutes.length
    ) {

      return;

    }

    this.dashboardRoutes.forEach(
      (
        route: any,
        routeIndex: number
      ) => {

        const coordinates:
          [number, number][] =
          (route?.areas ?? [])
            .map(
              (
                area: any
              ): [number, number] | null => {

                const areaId =
                  Number(
                    area?.area_id ??
                    area?.AreaId
                  );

                const location =
                  this.areaLocations.get(
                    areaId
                  );

                if (!location) {

                  return null;

                }

                return [
                  location.latitude,
                  location.longitude
                ];

              }
            )
            .filter(
              (
                coordinate:
                  [number, number] | null
              ): coordinate is [number, number] =>
                coordinate !== null
            );

        if (coordinates.length < 2) {

          return;

        }

        const routeCoordinates:
          [number, number][] = [
            ...coordinates,
            this.srpCoordinates
          ];

        const coordinateString =
          routeCoordinates
            .map(
              (
                [
                  latitude,
                  longitude
                ]
              ) =>
                `${longitude},${latitude}`
            )
            .join(';');

        this.subscriptions.add(
          this.http
            .get<any>(
              `${this.mlApiUrl.replace('/ml', '')}/map/route`,
              {
                params: {
                  coordinates:
                    coordinateString
                }
              }
            )
            .subscribe({

              next: response => {

                const geometry =
                  response
                    ?.routes?.[0]
                    ?.geometry
                    ?.coordinates;

                if (
                  response?.code === 'Ok' &&
                  geometry?.length
                ) {

                  const leafletCoordinates:
                    [number, number][] =
                    geometry.map(
                      (
                        [
                          longitude,
                          latitude
                        ]: [number, number]
                      ) =>
                        [
                          latitude,
                          longitude
                        ]
                    );

                  this.roadGeometry.set(
                    routeIndex,
                    leafletCoordinates
                  );

                } else {

                  this.roadGeometry.set(
                    routeIndex,
                    routeCoordinates
                  );

                }

                this.redrawRoadGeometry();

              },

              error: error => {

                console.error(
                  `Road routing failed for route #${String(routeIndex + 1).padStart(2, '0')}:`,
                  error
                );

                this.roadGeometry.set(
                  routeIndex,
                  routeCoordinates
                );

                this.redrawRoadGeometry();

              }

            })
        );

      }
    );

    this.addDisposalMarker();

  }

  private redrawRoadGeometry(): void {

    if (!this.routeLayer) {

      return;

    }

    // Keep the markers, but replace the temporary straight lines
    // with the actual road geometry returned by the routing service.

    this.routeLayer.eachLayer(
      layer => {

        if (
          layer instanceof L.Polyline
        ) {

          this.routeLayer!.removeLayer(
            layer
          );

        }

      }
    );

    this.dashboardRoutes.forEach(
      (
        route: any,
        routeIndex: number
      ) => {

        const geometry =
          this.roadGeometry.get(
            routeIndex
          );

        if (
          !geometry ||
          geometry.length < 2
        ) {

          return;

        }

        const color =
          this.routeColors[
            routeIndex %
            this.routeColors.length
          ] ?? '#0a8f3d';

        const polyline =
          L.polyline(
            geometry,
            {
              color,
              weight: 4,
              opacity: 0.9
            }
          );

        polyline.bindTooltip(
          `#${String(routeIndex + 1).padStart(2, '0')} — ${route?.vehicle_name ?? ''}`,
          {
            direction: 'top'
          }
        );

        this.routeLayer!.addLayer(
          polyline
        );

      }
    );

  }

  private addDisposalMarker(): void {

    if (!this.routeLayer) {

      return;

    }

    const marker =
      L.marker(
        this.srpCoordinates,
        {
          icon: L.divIcon({
            className:
              'route-number-marker',

            html: `
              <div style="
                background:#dc2626;
                width:28px;
                height:28px;
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
                D
              </div>
            `,

            iconSize: [28, 28],

            iconAnchor: [14, 14]
          })
        }
      );

    marker.bindTooltip(
      'SRP Disposal Destination',
      {
        direction: 'top'
      }
    );

    this.routeLayer.addLayer(
      marker
    );

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

  ngOnDestroy(): void {

    this.subscriptions.unsubscribe();

    this.wasteChart?.destroy();

    this.map?.remove();

  }

}