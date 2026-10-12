
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface AreaRow {
  areaName: string;
  populationDensity: number;
  latitude: number;
  longitude: number;
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

  areasError = '';
  wasteError = '';
  successMessage = '';

  isValidating = false;

  constructor(private router: Router) {}

  // STEP 1: SELECT AND VALIDATE AREAS CSV

  onAreasSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.areasError = '';
    this.successMessage = '';
    this.areas = [];
    this.areasFile = null;

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

        this.successMessage =
          `${this.areas.length} collection areas validated successfully.`;
      } catch (error) {
        this.areas = [];
        this.areasFile = null;

        this.areasError =
          error instanceof Error
            ? error.message
            : 'Unable to validate the areas CSV.';
      } finally {
        this.isValidating = false;
      }
    };

    reader.onerror = () => {
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

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.wasteFile = null;
      this.wasteError = 'Please select a CSV file.';
      input.value = '';
      return;
    }

    this.wasteFile = file;
    this.successMessage = '';

    input.value = '';
  }

  // REMOVE SELECTED FILES

  removeAreasFile(): void {
    this.areasFile = null;
    this.areas = [];
    this.areasError = '';
    this.successMessage = '';
  }

  removeWasteFile(): void {
    this.wasteFile = null;
    this.wasteError = '';
  }

  // NAVIGATION

  continueSetup(): void {
    this.areasError = '';
    this.wasteError = '';
    this.successMessage = '';

    // STEP 1: Areas are required for the import path.
    if (this.currentStep === 1) {
      if (this.isValidating) {
        this.areasError =
          'Please wait for CSV validation to finish.';
        return;
      }

      if (!this.areasFile || this.areas.length === 0) {
        this.areasError =
          'Please upload and validate your collection areas first.';
        return;
      }

      this.currentStep = 2;
      return;
    }

    // STEP 2: Historical waste data is optional.
    // This currently navigates to the truck page.
    // CSV files are not saved to the backend yet.
    if (this.currentStep === 2) {
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
    // Skip both CSV imports.
    // No areas, trucks, routes, or operations are created here.
    // Dashboard access still depends on the existing authGuard.
    this.router.navigate(['/dashboard']);
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
}
