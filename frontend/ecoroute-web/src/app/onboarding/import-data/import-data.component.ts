import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingDraftService } from '../../core/services/onboarding-draft.service';

interface AreaRow {
  areaName: string;
  populationDensity: number;
  latitude: number;
  longitude: number;
}

interface WasteRow {
  areaName: string;
  collectionDate: string;
  wasteType: string;
  weightKg: number;
  status: string;
}

@Component({
  selector: 'app-import-data',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-data.component.html',
  styleUrl: './import-data.component.scss'
})
export class ImportDataComponent {
  currentStep = 1;

  areasFile: File | null = null;
  wasteFile: File | null = null;

  areas: AreaRow[] = [];
  wasteRecords: WasteRow[] = [];


  areasError = '';
  wasteError = '';
  successMessage = '';

  isValidating = false;

  
constructor(
  private router: Router,
  private authService: AuthService,
  private onboardingDraft: OnboardingDraftService
) {
  this.currentStep = this.onboardingDraft.currentStep;
  this.areas = [...this.onboardingDraft.areas];
  this.wasteRecords = [...this.onboardingDraft.wasteRecords];
}


  // STEP 1: SELECT AND VALIDATE AREAS CSV

  onAreasSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.areasError = '';
    this.successMessage = '';
    this.areas = [];
    this.areasFile = null;
    this.onboardingDraft.areas = [];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.areasError = 'Please select a CSV file.';
      input.value = '';
      return;
    }

    this.areasFile = file;
    this.isValidating = true;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const content = String(reader.result ?? '');
        this.areas = this.parseAreasCsv(content);
        this.onboardingDraft.areas = [...this.areas];

        this.successMessage =
          `${this.areas.length} collection areas validated successfully.`;
      } catch (error) {
        this.areas = [];
        this.areasFile = null;
        this.onboardingDraft.areas = [];

        this.areasError =
          error instanceof Error
            ? error.message
            : 'Unable to validate the areas CSV.';
      } finally {
        this.isValidating = false;
      }
    };

    reader.onerror = () => {
      this.onboardingDraft.areas = [];
      this.areasFile = null;
      this.areas = [];
      this.isValidating = false;
      this.areasError = 'Unable to read this file.';
    };

    reader.readAsText(file);

    // Allow the same file to be selected again.
    input.value = '';
  }

  private parseAreasCsv(content: string): AreaRow[] {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error(
        'Your CSV must contain a header and at least one area.'
      );
    }

    const headers = this.parseCsvLine(lines[0]).map(
      header => header.trim().toLowerCase()
    );

    const requiredHeaders = [
      'areaname',
      'populationdensity',
      'latitude',
      'longitude'
    ];

    if (
      headers.length !== requiredHeaders.length ||
      !requiredHeaders.every(header => headers.includes(header))
    ) {
      throw new Error(
        'Use the areas template with exactly these columns: ' +
        'AreaName, PopulationDensity, Latitude, Longitude.'
      );
    }

    const indexes = {
      name: headers.indexOf('areaname'),
      density: headers.indexOf('populationdensity'),
      latitude: headers.indexOf('latitude'),
      longitude: headers.indexOf('longitude')
    };

    const rows: AreaRow[] = [];
    const seenNames = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCsvLine(lines[i]);
      const rowNumber = i + 1;

      if (row.length !== headers.length) {
        throw new Error(
          `Row ${rowNumber} has an incorrect number of columns.`
        );
      }

      const areaName = row[indexes.name].trim();
      const densityText = row[indexes.density].trim();
      const latitudeText = row[indexes.latitude].trim();
      const longitudeText = row[indexes.longitude].trim();

      const density = Number(densityText);
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);

      if (!areaName) {
        throw new Error(
          `Row ${rowNumber}: AreaName is required.`
        );
      }

      if (areaName.length > 100) {
        throw new Error(
          `Row ${rowNumber}: AreaName cannot exceed 100 characters.`
        );
      }

      const normalizedName = areaName.toLowerCase();

      if (seenNames.has(normalizedName)) {
        throw new Error(
          `Row ${rowNumber}: Duplicate area name "${areaName}".`
        );
      }

      if (
        densityText === '' ||
        !Number.isFinite(density) ||
        density < 0
      ) {
        throw new Error(
          `Row ${rowNumber}: PopulationDensity must be a non-negative number.`
        );
      }

      if (
        latitudeText === '' ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error(
          `Row ${rowNumber}: Latitude must be between -90 and 90.`
        );
      }

      if (
        longitudeText === '' ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error(
          `Row ${rowNumber}: Longitude must be between -180 and 180.`
        );
      }

      seenNames.add(normalizedName);

      rows.push({
        areaName,
        populationDensity: density,
        latitude,
        longitude
      });
    }

    return rows;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let value = '';
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        values.push(value);
        value = '';
      } else {
        value += char;
      }
    }

    if (quoted) {
      throw new Error(
        'Your CSV contains an unclosed quotation mark.'
      );
    }

    values.push(value);
    return values;
  }

  // DOWNLOAD AREAS TEMPLATE

  downloadAreasTemplate(): void {
    const csv =
      'AreaName,PopulationDensity,Latitude,Longitude\n' +
      'Maryville,6200,10.3749700,123.9165800\n' +
      'Silverhills,5100,10.3600625,123.9125625\n';

    this.downloadCsv(csv, 'ecoroute-areas-template.csv');
  }

  // STEP 2: SELECT HISTORICAL WASTE CSV

  
onWasteSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  this.wasteError = '';
  this.successMessage = '';
  this.wasteRecords = [];
  this.wasteFile = null;
  this.onboardingDraft.wasteRecords = [];

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    this.wasteError = 'Please select a CSV file.';
    input.value = '';
    return;
  }

  this.wasteFile = file;
  this.isValidating = true;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const content = String(reader.result ?? '');
      this.wasteRecords = this.parseWasteCsv(content);
      this.onboardingDraft.wasteRecords = [...this.wasteRecords];

      this.successMessage =
        `${this.wasteRecords.length} historical waste records validated successfully.`;
    } catch (error) {
      this.wasteRecords = [];
      this.wasteFile = null;
      this.onboardingDraft.wasteRecords = [];

      this.wasteError =
        error instanceof Error
          ? error.message
          : 'Unable to validate the historical waste CSV.';
    } finally {
      this.isValidating = false;
    }
  };

  reader.onerror = () => {
    this.onboardingDraft.wasteRecords = [];
    this.wasteFile = null;
    this.wasteRecords = [];
    this.isValidating = false;
    this.wasteError = 'Unable to read this file.';
  };

  reader.readAsText(file);

  // Allow the same file to be selected again.
  input.value = '';
}


private parseWasteCsv(content: string): WasteRow[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error(
      'Your CSV must contain a header and at least one waste record.'
    );
  }

  const headers = this.parseCsvLine(lines[0]).map(
    header => header.trim().toLowerCase()
  );

  const requiredHeaders = [
    'areaname',
    'collectiondate',
    'wastetype',
    'weightkg',
    'status'
  ];

  if (
    headers.length !== requiredHeaders.length ||
    !requiredHeaders.every(header => headers.includes(header))
  ) {
    throw new Error(
      'Use the waste template with exactly these columns: ' +
      'AreaName, CollectionDate, WasteType, WeightKg, Status.'
    );
  }

  const indexes = {
    areaName: headers.indexOf('areaname'),
    collectionDate: headers.indexOf('collectiondate'),
    wasteType: headers.indexOf('wastetype'),
    weightKg: headers.indexOf('weightkg'),
    status: headers.indexOf('status')
  };

  const rows: WasteRow[] = [];
  const seenRecords = new Set<string>();
  const validWasteTypes = [
    'Biodegradable',
    'Non-biodegradable'
  ];

  for (let i = 1; i < lines.length; i++) {
    const row = this.parseCsvLine(lines[i]);
    const rowNumber = i + 1;

    if (row.length !== headers.length) {
      throw new Error(
        `Row ${rowNumber} has an incorrect number of columns.`
      );
    }

    const areaName = row[indexes.areaName].trim();
    const dateText = row[indexes.collectionDate].trim();
    const wasteTypeText = row[indexes.wasteType].trim();
    const weightText = row[indexes.weightKg].trim();
    const statusText = row[indexes.status].trim();

    if (!areaName) {
      throw new Error(`Row ${rowNumber}: AreaName is required.`);
    }

    if (areaName.length > 100) {
      throw new Error(
        `Row ${rowNumber}: AreaName cannot exceed 100 characters.`
      );
    }

const matchingArea = this.areas.find(
  area =>
    area.areaName.trim().toLowerCase() ===
    areaName.trim().toLowerCase()
);

if (!matchingArea) {
  throw new Error(
    `Row ${rowNumber}: AreaName "${areaName}" does not match any area in your uploaded areas CSV. Check the spelling and upload the correct area name.`
  );
}

    // Require a real YYYY-MM-DD calendar date.
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);

    if (!dateMatch) {
      throw new Error(
        `Row ${rowNumber}: CollectionDate must use YYYY-MM-DD format.`
      );
    }


const today = new Date();
const todayLocalDate =
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

if (dateText >= todayLocalDate) {
  throw new Error(
    `Row ${rowNumber}: CollectionDate must be earlier than today (${todayLocalDate}). Today's and future dates are not allowed.`
  );
}


    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      throw new Error(
        `Row ${rowNumber}: CollectionDate is not a valid calendar date.`
      );
    }

    const wasteType = validWasteTypes.find(
      type => type.toLowerCase() === wasteTypeText.toLowerCase()
    );

    if (!wasteType) {
      throw new Error(
        `Row ${rowNumber}: WasteType must be Biodegradable or Non-biodegradable.`
      );
    }

    const weightKg = Number(weightText);
  
if (
  weightText === '' ||
  !Number.isFinite(weightKg) ||
  weightKg <= 0 ||
  weightKg > 99999999.99
) {
  throw new Error(
    `Row ${rowNumber}: WeightKg must be a valid number greater than zero.`
  );
}


    
const validStatuses = ['Completed', 'Failed'];

const status = validStatuses.find(
  value => value.toLowerCase() === statusText.toLowerCase()
);

if (!status) {
  throw new Error(
    `Row ${rowNumber}: Status must be Completed or Failed.`
  );
}


    // Matches the backend's within-file duplicate rule.
    const duplicateKey =
      `${areaName.toLowerCase()}|${dateText}|${wasteType.toLowerCase()}`;

    if (seenRecords.has(duplicateKey)) {
      throw new Error(
        `Row ${rowNumber}: Duplicate record for ${areaName}, ${dateText}, ${wasteType}.`
      );
    }

    seenRecords.add(duplicateKey);

    rows.push({
      areaName,
      collectionDate: dateText,
      wasteType,
      weightKg,
      status
    });
  }

  return rows;
}


  // REMOVE SELECTED FILES

removeAreasFile(): void {
  this.areasFile = null;
  this.areas = [];
  this.onboardingDraft.areas = [];
  this.areasError = '';
  this.successMessage = '';
}

removeWasteFile(): void {
  this.wasteFile = null;
  this.wasteRecords = [];
  this.onboardingDraft.wasteRecords = [];
  this.wasteError = '';
  this.successMessage = '';
}

  // NAVIGATION


continueSetup(): void {
  this.areasError = '';
  this.wasteError = '';
  this.successMessage = '';

  if (this.isValidating) {
    return;
  }

  if (this.currentStep === 1) {
    if (this.areas.length === 0) {
      this.areasError =
        'Please upload and validate your collection areas first.';
      return;
    }

    // Continue without importing anything into the database.
    this.currentStep = 2;
    this.onboardingDraft.currentStep = 2;
    return;
  }

  if (this.currentStep === 2) {
    // Historical waste data is optional.
    if (this.wasteFile && this.wasteRecords.length === 0) {
      this.wasteError =
        'Please select a valid waste CSV or remove the selected file.';
      return;
    }

    // Continue to trucks without importing anything yet.
    this.onboardingDraft.currentStep = 2;
    this.router.navigate(['/onboarding/add-trucks']);
  }
}

  goBack(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.areasError = '';
      this.wasteError = '';
      this.successMessage = '';
    }
  }

  // PATH C: START FROM SCRATCH

  
startFromScratch(): void {
  this.areasError = '';
  this.wasteError = '';
  this.successMessage = '';

  this.isValidating = true;
  this.onboardingDraft.currentStep = 1;
  this.onboardingDraft.reset();

  this.authService.completeOnboarding().subscribe({
    next: response => {
      // Keep the local user status consistent with the server.
      const user = this.authService.getUser();

      if (user) {
        localStorage.setItem(
          'ecoroute_user',
          JSON.stringify({
            ...user,
            isOnboardingComplete: response.isOnboardingComplete
          })
        );
      }

      this.isValidating = false;
      this.router.navigate(['/dashboard']);
    },
    error: error => {
      this.isValidating = false;

      this.areasError =
        error?.error?.message ||
        'Unable to finish setup. Please try again.';
    }
  });
}


  // DOWNLOAD WASTE TEMPLATE

  downloadWasteTemplate(): void {
    const csv =
      'AreaName,CollectionDate,WasteType,WeightKg,Status\n' +
      'Maryville,2026-09-01,Biodegradable,125.50,Completed\n' +
      'Maryville,2026-09-02,Non-biodegradable,86.25,Completed\n';

    this.downloadCsv(csv, 'ecoroute-waste-data-template.csv');
  }

  // CSV DOWNLOAD HELPER

  private downloadCsv(
    content: string,
    filename: string
  ): void {
    const blob = new Blob([content], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  get hasAreasData(): boolean {
  return this.areas.length > 0;
}

get hasWasteData(): boolean {
  return this.wasteRecords.length > 0;
}
}
