import { environment } from '../../environments/environment';

import { Component, OnInit } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-waste-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waste-data.component.html',
  styleUrl: './waste-data.component.scss'
})
export class WasteDataComponent implements OnInit {

  systemDate = '';

  // SUMMARY DATA

  totalWasteCollected = 0;
  averageDailyWaste = 0;
  highestWasteArea = '';
  highestWasteAreaWeight = 0;
  collectionAreas = 0;
  totalWasteChangePercent = 0;
  averageDailyWasteChangePercent = 0;

  // DATE RANGE

  dateRangeOptions = [
    'Last 30 Days',
    'Last 7 Days',
    'All Time'
  ];

  selectedDateRange = 'Last 30 Days';

  // WASTE AREA DATA

  wasteAreas: {
    name: string;
    value: number;
    color: string;
  }[] = [];

  wasteAreaColors = [
    '#00c853',
    '#4f7cac',
    '#ff9800',
    '#8b5cf6',
    '#ef4444',
    '#14b8a6',
    '#f59e0b',
    '#6366f1',
    '#ec4899',
    '#06b6d4'
  ];

  // AREA PARAMETERS

  areaParameters: {
    area: string;
    density: string;
    activity: string;
    frequency: string;
  }[] = [];

  // RECENT COLLECTIONS

  recentCollections: {
    id: number;
    date: string;
    area: string;
    type: string;
    weight: number;
    status: string;
  }[] = [];

  searchTerm = '';
  wasteTypeFilter = 'All';

  // CONSTRUCTOR

  constructor(private http: HttpClient) {}

  // GETTERS

  // Returns the highest waste value among all collection areas.
  get maxWaste(): number {
    return Math.max(
      ...this.wasteAreas.map(
        area => area.value
      )
    );
  }

  // Returns the collections filtered by search term and waste type.
  get filteredCollections() {
    const search =
      this.searchTerm
        .toLowerCase()
        .trim();

    return this.recentCollections.filter(
      collection => {
        const areaMatch =
          collection.area
            .toLowerCase()
            .includes(search);

        const typeMatch =
          this.wasteTypeFilter === 'All' ||
          collection.type === this.wasteTypeFilter;

        return areaMatch && typeMatch;
      }
    );
  }

  // LIFECYCLE

  // Loads the waste data when the component initializes.
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

        this.loadWasteSummary();
        this.loadAreaWasteSummary();
        this.loadAreaParameters();
        this.loadRecentCollections();
      },
      error: (error) => {
        console.error(
          'Failed to fetch system date:',
          error
        );
      }
    });
}

  // DATA LOADING

  // Loads the recent waste collection records based on the selected date range.
  loadRecentCollections(): void {
    const range =
      this.getDateRange();

    let params =
      new HttpParams();

    if (range.startDate) {
      params = params.set(
        'startDate',
        range.startDate
      );
    }

    if (range.endDate) {
      params = params.set(
        'endDate',
        range.endDate
      );
    }

    this.http
      .get<any[]>(
        `${environment.apiUrl}/Waste`,
        { params }
      )
      .subscribe({
        next: data => {
          this.recentCollections =
            data.map(record => ({
              id: record.wasteRecordId,

              date: new Date(
                record.collectionDate
              ).toLocaleDateString(
                'en-US',
                {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }
              ),

              area: record.areaName,
              type: record.wasteType,
              weight: record.weightKg,
              status: record.status
            }));
        },

        error: error => {
          console.error(
            'Failed to load recent waste collections:',
            error
          );
        }
      });
  }

  // Loads the waste collection parameters for each area.
  loadAreaParameters(): void {
    const range =
      this.getDateRange();

    let params =
      new HttpParams();

    if (range.startDate) {
      params = params.set(
        'startDate',
        range.startDate
      );
    }

    if (range.endDate) {
      params = params.set(
        'endDate',
        range.endDate
      );
    }

    this.http
      .get<any[]>(
        `${environment.apiUrl}/Waste/area-parameters`,
        { params }
      )
      .subscribe({
        next: data => {
          this.areaParameters =
            data.map(parameter => ({
              area: parameter.area,
              density: parameter.density,
              activity: parameter.activity,
              frequency: parameter.frequency
            }));
        },

        error: error => {
          console.error(
            'Failed to load area parameters:',
            error
          );
        }
      });
  }

  // Loads the overall waste collection summary.
  loadWasteSummary(): void {
    const range =
      this.getDateRange();

    let params =
      new HttpParams();

    if (range.startDate) {
      params = params.set(
        'startDate',
        range.startDate
      );
    }

    if (range.endDate) {
      params = params.set(
        'endDate',
        range.endDate
      );
    }

    this.http
      .get<any>(
        `${environment.apiUrl}/Waste/summary`,
        { params }
      )
      .subscribe({
        next: data => {
          this.totalWasteCollected =
            data.totalWasteCollected;

          this.averageDailyWaste =
            data.averageDailyWaste;

          this.totalWasteChangePercent =
            data.totalWasteChangePercent;

          this.averageDailyWasteChangePercent =
            data.averageDailyWasteChangePercent;

          this.highestWasteArea =
            data.highestWasteArea;

          this.highestWasteAreaWeight =
            data.highestWasteAreaWeight;

          this.collectionAreas =
            data.collectionAreas;
        },

        error: error => {
          console.error(
            'Failed to load waste summary:',
            error
          );
        }
      });
  }

  // Loads the total waste collected by area.
  loadAreaWasteSummary(): void {
    const range =
      this.getDateRange();

    let params =
      new HttpParams();

    if (
      this.selectedDateRange ===
      'All Time'
    ) {
      params = params.set(
        'allTime',
        'true'
      );
    } else {
      params = params.set(
        'startDate',
        range.startDate!
      );

      params = params.set(
        'endDate',
        range.endDate!
      );
    }

    this.http
      .get<any[]>(
        `${environment.apiUrl}/Waste/area-summary`,
        { params }
      )
      .subscribe({
        next: data => {
          this.wasteAreas =
            data.map(
              (area, index) => ({
                name: area.areaName,
                value: area.totalWaste,

                color:
                  this.wasteAreaColors[
                    index %
                    this.wasteAreaColors.length
                  ]
              })
            );
        },

        error: error => {
          console.error(
            'Failed to load area waste summary:',
            error
          );
        }
      });
  }

  // DISPLAY HELPERS

  // Calculates the percentage width of an area bar based on the maximum waste value.
  getBarWidth(
    value: number
  ): number {
    return (
      value /
      this.maxWaste
    ) * 100;
  }

  // Calculates the selected date range for API requests.
  
getDateRange(): {
  startDate: string | null;
  endDate: string | null;
} {
  if (
    this.selectedDateRange ===
    'All Time'
  ) {
    return {
      startDate: null,
      endDate: null
    };
  }

  const [year, month, day] =
    this.systemDate.split('-').map(Number);

  const endDate =
    new Date(year, month - 1, day);

  const days =
    this.selectedDateRange ===
    'Last 7 Days'
      ? 6
      : 29;

  const startDate =
    new Date(endDate);

  startDate.setDate(
    endDate.getDate() - days
  );

  const formatDate =
    (date: Date): string => {
      const year = date.getFullYear();

      const month = String(
        date.getMonth() + 1
      ).padStart(2, '0');

      const day = String(
        date.getDate()
      ).padStart(2, '0');

      return `${year}-${month}-${day}`;
    };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}


  // DATE RANGE

  // Cycles through the available date range options and reloads the data.
  toggleDateRange(): void {
    const currentIndex =
      this.dateRangeOptions.indexOf(
        this.selectedDateRange
      );

    const nextIndex =
      (currentIndex + 1) %
      this.dateRangeOptions.length;

    this.selectedDateRange =
      this.dateRangeOptions[
        nextIndex
      ];

    this.loadWasteSummary();
    this.loadAreaWasteSummary();
    this.loadAreaParameters();
    this.loadRecentCollections();
  }

  // CSV EXPORT

  // Exports the currently loaded waste collection records as a CSV file.
  exportCsv(): void {
    if (
      this.recentCollections.length ===
      0
    ) {
      return;
    }

    const headers = [
      'Date',
      'Collection Area',
      'Waste Type',
      'Weight (kg)',
      'Status'
    ];

    const rows =
      this.recentCollections.map(
        collection => [
          collection.date,
          collection.area,
          collection.type,

          collection.status ===
          'Completed'
            ? collection.weight
            : '',

          collection.status
        ]
      );

    const csvContent = [
      headers,
      ...rows
    ]
      .map(
        row =>
          row
            .map(
              value =>
                `"${String(value).replace(
                  /"/g,
                  '""'
                )}"`
            )
            .join(',')
      )
      .join('\n');

    const blob =
      new Blob(
        [csvContent],
        {
          type:
            'text/csv;charset=utf-8;'
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `ecoroute-waste-data-${this.selectedDateRange
        .toLowerCase()
        .replace(/ /g, '-')}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  }
}