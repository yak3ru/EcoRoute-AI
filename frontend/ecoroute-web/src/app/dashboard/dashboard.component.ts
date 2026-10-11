import { environment } from '../../environments/environment';
import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
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

  // ============================================================
  // BASIC DATA
  // ============================================================

  currentDate = '';
  systemDate = '';

  // ============================================================
  // DASHBOARD MAP ROUTES
  // ============================================================

  private dashboardRoutes: any[] = [];

  private readonly areasApiUrl =
    `${environment.apiUrl}/areas`;

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

  // ============================================================
  // AI PREDICTION DATA
  // ============================================================

  hasPredictionInsight = false;
  isPredictionFallback = false;
  predictionInsightDate = '';
  predictionInsightEmptyMessage =
    'No prediction available yet. Upload waste collection data to generate your first AI insight.';


  predictionLevel = '';

  predictionInsight = '';

  predictionAction = '';

  predictionTarget = '';

  aiPredictedWaste = 0;

  aiNormalWaste = 0;

  aiPredictionChange = 0;

  // ============================================================
  // CHART DATA
  // ============================================================

  chartStartDate = new Date(0);

  chartDays: {
    date: Date;
    label: string;
    dateLabel: string;
    wasteKg: number | null;
    status: string;
  }[] = [];

  // ============================================================
  // API AND SERVICES
  // ============================================================

  private readonly mlApiUrl =
    `${environment.apiUrl}/ml`;

  private readonly wasteApiUrl =
    `${environment.apiUrl}/Waste`;

  private http = inject(HttpClient);

  private subscriptions = new Subscription();

  // ============================================================
  // VIEW REFERENCES
  // ============================================================

  private wasteChart?: Chart;

  private map?: L.Map;

  private routeLayer?: L.LayerGroup;

  // ============================================================
  // DASHBOARD SUMMARY DATA
  // ============================================================

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

  // ============================================================
  // LIFECYCLE METHODS
  // ============================================================

  // Initializes the dashboard and starts loading its data.
  
ngOnInit(): void {
  this.subscriptions.add(
    this.http
      .get<{
        timeZone: string;
        currentDate: string;
        currentDateTime: string;
      }>(`${environment.apiUrl}/system/time`, {
        withCredentials: true
      })
      .subscribe({
        next: response => {
          this.systemDate = response.currentDate;
          this.chartStartDate = this.getStartOfChartPeriod();

          const [year, month, day] =
            response.currentDate.split('-').map(Number);

          this.currentDate = new Date(
            year,
            month - 1,
            day
          ).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });
          
          this.loadAreaLocations();
          this.loadDashboardData();
          this.loadCollectionHistory();

        },
        error: error => {
          console.error(
            'Failed to get Philippine system date:',
            error
          );
        }
      })
  );
}


  // Initializes the chart and map after the dashboard view is ready.
  
  ngAfterViewInit(): void {
    this.createWasteChart();
    this.createCollectionMap();

    if (this.mapOperationDate) {
      this.updateCollectionMap();
    }
  }

  // Cleans up subscriptions, the chart, and the map when the component is destroyed.
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.wasteChart?.destroy();
    this.map?.remove();
  }

  // ============================================================
  // DASHBOARD DATA
  // ============================================================

  // Checks the current operation status and loads the correct dashboard data.
  
private loadDashboardData(): void {
  const today = this.systemDate;

  this.subscriptions.add(
    this.http
      .get<{ status: string; hasWasteData: boolean }>(
        `${this.mlApiUrl}/routes/operation/status/${today}`
      )
      .subscribe({
        next: response => {
          this.dashboardMode = 'current';

          if (response.status === 'Cancelled') {
            this.dashboardMode = 'previous';
            this.loadPreviousOperation();
            this.loadPredictionForDate(today);
            return;
          }

          if (
            response.status === 'Completed' &&
            !response.hasWasteData
          ) {
            this.loadCurrentOperation(today, false);
            this.loadPredictionForDate(today);
            return;
          }

          this.loadCurrentOperation(today);
        },

          error: error => {
            if (error.status !== 404) {
              console.error(
                'Failed to load dashboard operation status:',
                error
              );
            }

            this.dashboardMode = 'previous';
            this.loadPreviousOperation();
            this.loadPredictionForDate(today);
          }
      })
  );
}


  // Loads the AI waste prediction for the selected date.
  
private loadPredictionForDate(
  targetDate: string
): void {
  this.subscriptions.add(
    this.http
      .get<any>(
        `${this.mlApiUrl}/insights?targetDate=${targetDate}`
      )
      .subscribe({
        
next: response => {
  console.log('AI INSIGHT API RESPONSE:', response);

  if (response?.hasInsight === false) {
    this.hasPredictionInsight = false;
    this.isPredictionFallback = false;
    this.predictionInsightDate = '';

    this.aiPredictedWaste = 0;
    this.aiNormalWaste = 0;
    this.aiPredictionChange = 0;
    this.predictionLevel = '';
    this.predictionInsight = '';
    this.predictionAction = '';

    this.predictionInsightEmptyMessage =
      response.message ??
      'No prediction available yet. Upload waste collection data to generate your first AI insight.';

    return;
  }

  this.hasPredictionInsight = true;
  this.isPredictionFallback = response?.isFallback === true;
  this.predictionInsightDate = response?.targetDate ?? targetDate;

  this.predictionTarget =
    targetDate === this.systemDate
      ? 'today'
      : 'tomorrow';

  this.aiPredictedWaste =
    Number(response?.predictedWasteKg ?? 0);

  this.aiNormalWaste =
    Number(response?.normalWasteKg ?? 0);

  this.aiPredictionChange =
    Number(response?.predictionChangePercent ?? 0);

  this.predictionLevel =
    response?.predictionLevel ?? '';

  this.predictionInsight =
    response?.insightMessage ?? '';

  this.predictionAction =
    response?.suggestedAction ?? '';

  console.log('hasPredictionInsight:', this.hasPredictionInsight);
  console.log('isPredictionFallback:', this.isPredictionFallback);
  console.log('Saved insight target:', this.predictionInsightDate);
  console.log('Saved predicted waste:', this.aiPredictedWaste);
},


        error: error => {
          console.error(
            'Failed to load saved prediction insight:',
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


  // Loads recent waste records to calculate the normal waste baseline.
  private loadNormalWasteBaseline(): void {
    const [year, month, day] =
  this.systemDate.split('-').map(Number);

const todayDate = new Date(
  year,
  month - 1,
  day
);

const today =
  this.systemDate;

console.log(
  'Starting normal waste baseline...'
);

console.log(
  'Today:',
  today
);

// Look back 30 days for actual waste records

const startDate = new Date(
  year,
  month - 1,
  day
);

startDate.setDate(
  startDate.getDate() - 30
);

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

            if (
              !records ||
              records.length === 0
            ) {
              console.log(
                'No historical waste records found.'
              );

              this.aiNormalWaste = 0;
              this.calculatePredictionInsight();

              return;
            }

            // Group waste by collection date

            const dailyWaste =
              new Map<string, number>();

            records.forEach(record => {
              const recordDate =
                new Date(
                  record.collectionDate
                );

              const date =
                this.toLocalDateString(
                  recordDate
                );

              // Do not include today

              if (date >= today) {
                return;
              }

              const weight =
                Number(
                  record.weightKg || 0
                );

              dailyWaste.set(
                date,
                (dailyWaste.get(date) || 0) +
                weight
              );
            });

            console.log(
              'Daily historical waste:',
              dailyWaste
            );

            // Get the most recent 7 days
            // that actually have waste records

            const validDays =
              Array.from(
                dailyWaste.entries()
              )
                .sort(
                  (a, b) =>
                    b[0].localeCompare(a[0])
                )
                .slice(0, 7);

            console.log(
              'Valid historical waste days:',
              validDays
            );

            if (
              validDays.length === 0
            ) {
              this.aiNormalWaste = 0;
            } else {
              const totalWaste =
                validDays.reduce(
                  (total, [, waste]) =>
                    total + waste,
                  0
                );

              this.aiNormalWaste =
                totalWaste /
                validDays.length;
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

  // Calculates the prediction change and determines the dashboard insight.
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
        (
          this.aiPredictedWaste -
          this.aiNormalWaste
        ) /
        this.aiNormalWaste
      ) *
      100;

    this.aiPredictionChange =
      Math.round(
        this.aiPredictionChange * 100
      ) / 100;

    if (
      this.aiPredictionChange >= 20
    ) {
      this.predictionLevel =
        'Much higher than normal';

      this.predictionInsight =
        'High waste generation expected';

      this.predictionAction =
        'Prepare additional collection capacity';
    } else if (
      this.aiPredictionChange >= 5
    ) {
      this.predictionLevel =
        'Slightly higher';

      this.predictionInsight =
        'Waste generation expected to increase';

      this.predictionAction =
        'Prepare for increased waste volume';
    } else if (
      this.aiPredictionChange >= -5
    ) {
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

  // Loads the current operation and updates the dashboard route information.
  private loadCurrentOperation(
    date: string,
    predictNextDay: boolean = true
  ): void {
    this.subscriptions.add(
      this.http
        .get<any>(
          `${this.mlApiUrl}/routes/history/${date}`
        )
        .subscribe({
          next: response => {
            this.applyOperationData(
              response
            );

            this.dashboardRoutes =
              response?.routes ?? [];

            this.mapOperationDate = date;

            this.loadActualWaste(date, predictNextDay);

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

  // Loads the most recent completed operation for the dashboard.
  private loadPreviousOperation(): void {
    this.subscriptions.add(
      this.http
        .get<string[]>(
          `${this.mlApiUrl}/routes/history/dates`
        )
        .subscribe({
          next: dates => {
            const today = this.systemDate;

            const previousDate =
              dates
                .filter(
                  date => date !== today
                )
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
                    this.applyOperationData(
                      response
                    );

                    this.dashboardRoutes =
                      response?.routes ?? [];

                    this.loadActualWaste(
                      previousDate,
                      false
                    );

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

  // Applies operation data to the dashboard summary values.
  private applyOperationData(
    response: any
  ): void {
    const routes =
      response?.routes ?? [];

    this.routeCount =
      routes.length;

    this.vehicleCount =
      new Set(
        routes
          .map(
            (route: any) =>
              route.vehicle_id
          )
          .filter(
            (vehicleId: any) =>
              vehicleId !== null &&
              vehicleId !== undefined
          )
      ).size;

    this.predictedWasteValue =
      routes.reduce(
        (
          total: number,
          route: any
        ) =>
          total +
          Number(
            route.load_kg || 0
          ),
        0
      );

    this.predictedWasteValue =
      Math.round(
        this.predictedWasteValue * 100
      ) / 100;
  }

  // load the actual collected waste for the selected operation date.
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
                  Number(
                    record.weightKg || 0
                  ),
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
              const [year, month, day] =
                this.systemDate.split('-').map(Number);

              const tomorrow = new Date(
                year,
                month - 1,
                day
              );

              tomorrow.setDate(tomorrow.getDate() + 1);

              const tomorrowString =
                `${tomorrow.getFullYear()}-${String(
                  tomorrow.getMonth() + 1
                ).padStart(2, '0')}-${String(
                  tomorrow.getDate()
                ).padStart(2, '0')}`;

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

  // Clears the dashboard summary values when no operation is available.
  private clearDashboardData(): void {
    this.wasteValue = 0;
    this.predictedWasteValue = 0;
    this.routeCount = 0;
    this.vehicleCount = 0;
    this.totalVehicles = 0;
    this.hasWasteData = false;
  }

  // Converts a Date value into the local YYYY-MM-DD format.
  private toLocalDateString(
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

    return `${year}-${month}-${day}`;
  }

  // Formats the actual waste value for display.
  
  get wasteDisplay(): string {
    if (!this.hasWasteData) {
      return 'No data';
    }

    return `${(
      this.wasteValue / 1000
    ).toFixed(1)} tons`;
  }

  // Formats the predicted waste value for display.
  get predictedWasteDisplay(): string {
    return `${(
      this.predictedWasteValue / 1000
    ).toFixed(1)} tons`;
  }

  // ============================================================
  // MAP SIZE
  // ============================================================

  // Toggles the dashboard map between its normal and expanded sizes.
  toggleMapSize(): void {
    this.isMapExpanded =
      !this.isMapExpanded;

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 500);
  }

  // ============================================================
  // WASTE CHART
  // ============================================================

  // Creates the waste collection chart.
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
                  label: context => {
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

                  callback: value => {
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

  // Loads the operation dates needed for the collection history chart.
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

            this.buildEmptyChart(
              startDate
            );
          }
        })
    );
  }

  // Loads waste records and builds the collection history chart data.
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
      this.toLocalDateString(
        startDate
      );

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
                  this.toLocalDateString(
                    date
                  );

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
                            record.weightKg ||
                            0
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
                } else if (
                  hasOperation
                ) {
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

            this.buildEmptyChart(
              startDate
            );
          }
        })
    );
  }

  // Updates the waste chart with the current chart data.
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

  // Builds an empty seven day chart when collection data is unavailable.
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

  // Moves the collection history chart to the previous seven day period.
  previousChartPeriod(): void {
    this.chartStartDate =
      new Date(
        this.chartStartDate
      );

    this.chartStartDate.setDate(
      this.chartStartDate.getDate() - 7
    );

    this.loadCollectionHistory();
  }

  // Moves the collection history chart to the next seven day period.
  nextChartPeriod(): void {
    const nextStartDate =
      new Date(
        this.chartStartDate
      );

    nextStartDate.setDate(
      nextStartDate.getDate() + 7
    );

    const [year, month, day] =
      this.systemDate.split('-').map(Number);

    const today =
      new Date(year, month - 1, day);

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

  // Converts a Date value into the local date and time format.
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

  // Gets the starting date for the current seven day chart period.
  // Gets the starting date for the current seven day chart period.
private getStartOfChartPeriod(): Date {
  const [year, month, day] =
    this.systemDate.split('-').map(Number);

  const today =
    new Date(year, month - 1, day);

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

  // ============================================================
  // COLLECTION MAP
  // ============================================================

  // Loads area coordinates used by the collection map.
  private loadAreaLocations(): void {
    this.subscriptions.add(
      this.http
        .get<any[]>(
          this.areasApiUrl
        )
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

  // Creates and initializes the dashboard collection map.
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
      L.layerGroup().addTo(
        this.map
      );

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

  // Adds the OpenStreetMap tile layer to the dashboard map.
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

  // Updates the map with the current collection routes and stops.
  private updateCollectionMap(): void {
    if (
      !this.map ||
      !this.routeLayer
    ) {
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
      (
        route: any,
        routeIndex: number
      ) => {
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
              ): coordinate is [
                number,
                number
              ] =>
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

  // Draws a dashboard route and its numbered collection markers.
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

  // Loads road geometry for each dashboard route.
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
              ): coordinate is [
                number,
                number
              ] =>
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
                      ) => [
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

  // Replaces temporary route lines with the loaded road geometry.
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

  // Adds the SRP disposal destination marker to the map.
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

  // Creates the numbered map icon used for route stops.
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
}