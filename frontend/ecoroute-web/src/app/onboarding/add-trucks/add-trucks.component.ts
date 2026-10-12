import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingDraftService } from '../../core/services/onboarding-draft.service';
import { LoadingScreenComponent } from '../../shared/loading-screen/loading-screen.component';
import { AlertPopupComponent } from '../../shared/alert-popup/alert-popup.component';

interface Truck {
  id: number;
  vehicleName: string;
  capacityKg: number;
  maximumRouteDistanceKm: number;
  collectionStartTime: string;
  collectionEndTime: string;
  status: string;
}

@Component({
  selector: 'app-add-trucks',
  standalone: true,
  imports: [
  CommonModule,
  FormsModule,
  LoadingScreenComponent,
  AlertPopupComponent
],
  templateUrl: './add-trucks.component.html',
  styleUrl: './add-trucks.component.scss'
})
export class AddTrucksComponent {
  vehicleName = '';
  capacityKg: number | null = null;
  maximumRouteDistanceKm: number | null = null;
  collectionStartTime = '';
  collectionEndTime = '';

  readonly status = 'Available';

  trucks: Truck[] = [];
  editingTruckId: number | null = null;
  private nextTruckId = 1;

  errorMessage = '';
  successMessage = '';

  isSaving = false;
  isCompletingSetup = false;
  processingPending = false;

  constructor(
  private router: Router,
  private authService: AuthService,
  private onboardingDraft: OnboardingDraftService
) {
  this.trucks = this.onboardingDraft.trucks.map(truck => ({
    ...truck
  }));

  this.nextTruckId =
    this.trucks.reduce(
      (maximum, truck) => Math.max(maximum, truck.id),
      0
    ) + 1;
}

  
submitTruck(): void {
  this.errorMessage = '';
  this.successMessage = '';

  if (this.isSaving || this.isCompletingSetup) {
    return;
  }

  const name = this.vehicleName.trim();

  if (!name || name.length > 100) {
    this.errorMessage =
      'Please enter a truck name between 1 and 100 characters.';
    return;
  }

  if (
    this.capacityKg === null ||
    !Number.isFinite(this.capacityKg) ||
    this.capacityKg <= 0
  ) {
    this.errorMessage =
      'Please enter a valid capacity greater than 0.';
    return;
  }

  if (
    this.maximumRouteDistanceKm === null ||
    !Number.isFinite(this.maximumRouteDistanceKm) ||
    this.maximumRouteDistanceKm <= 0
  ) {
    this.errorMessage =
      'Please enter a maximum route distance greater than 0.';
    return;
  }

  if (!this.collectionStartTime || !this.collectionEndTime) {
    this.errorMessage = 'Please enter both collection times.';
    return;
  }

  if (this.collectionStartTime >= this.collectionEndTime) {
    this.errorMessage =
      'Collection end time must be later than start time.';
    return;
  }

  const duplicateName = this.trucks.some(
    truck =>
      truck.vehicleName.trim().toLowerCase() === name.toLowerCase() &&
      truck.id !== this.editingTruckId
  );

  if (duplicateName) {
    this.errorMessage =
      'A truck with this name has already been added.';
    return;
  }

  const truck: Truck = {
    id: this.editingTruckId ?? this.nextTruckId++,
    vehicleName: name,
    capacityKg: this.capacityKg,
    maximumRouteDistanceKm: this.maximumRouteDistanceKm,
    collectionStartTime: this.collectionStartTime,
    collectionEndTime: this.collectionEndTime,
    status: 'Available'
  };

  if (this.editingTruckId !== null) {
    this.trucks = this.trucks.map(item =>
      item.id === truck.id ? truck : item
    );

    this.successMessage =
      `${truck.vehicleName} updated successfully.`;
  } else {
    this.trucks = [...this.trucks, truck];

    this.successMessage =
      `${truck.vehicleName} added successfully.`;
  }

  this.onboardingDraft.trucks = this.trucks.map(item => ({
    ...item
  }));

  this.resetForm();
}


  editTruck(truck: Truck): void {
    this.editingTruckId = truck.id;
    this.vehicleName = truck.vehicleName;
    this.capacityKg = truck.capacityKg;
    this.maximumRouteDistanceKm = truck.maximumRouteDistanceKm;
    this.collectionStartTime = truck.collectionStartTime;
    this.collectionEndTime = truck.collectionEndTime;

    this.errorMessage = '';
    this.successMessage = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  
deleteTruck(id: number): void {
  if (this.isSaving || this.isCompletingSetup) {
    return;
  }

  const truck = this.trucks.find(item => item.id === id);

  if (!truck) {
    return;
  }

  this.trucks = this.trucks.filter(item => item.id !== id);

  this.onboardingDraft.trucks = this.trucks.map(item => ({
    ...item
  }));

  if (this.editingTruckId === id) {
    this.resetForm();
  }

  this.errorMessage = '';
  this.successMessage =
    `${truck.vehicleName} removed from the draft.`;
}


  cancelEdit(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.vehicleName = '';
    this.capacityKg = null;
    this.maximumRouteDistanceKm = null;
    this.collectionStartTime = '';
    this.collectionEndTime = '';
    this.editingTruckId = null;
    this.errorMessage = '';
  }

    goBack(): void {
    this.router.navigate(['/onboarding/import-data']);
  }
  

completeSetup(): void {
  this.errorMessage = '';
  this.successMessage = '';

  if (this.isCompletingSetup || this.isSaving) {
    return;
  }

  // If import rows were already committed, retry processing only; never post them again.
  if (this.processingPending) {
    this.retryProcessing();
    return;
  }

  if (this.trucks.length === 0) {
    this.errorMessage =
      'Please add at least one truck before continuing.';
    return;
  }

  this.isCompletingSetup = true;

  const draft = this.onboardingDraft;

  const payload = {
    areas: draft.areas.map(area => ({
      areaName: area.areaName,
      populationDensity: area.populationDensity,
      latitude: area.latitude,
      longitude: area.longitude
    })),

    wasteRecords: draft.wasteRecords.map(record => ({
      areaName: record.areaName,
      collectionDate: record.collectionDate,
      wasteType: record.wasteType,
      weightKg: record.weightKg,
      status: record.status
    })),

    trucks: this.trucks.map(truck => ({
      vehicleName: truck.vehicleName,
      capacityKg: truck.capacityKg,
      maximumRouteDistanceKm: truck.maximumRouteDistanceKm,
      collectionStartTime: truck.collectionStartTime,
      collectionEndTime: truck.collectionEndTime
    }))
  };

  this.authService.finalizeOnboarding(payload).subscribe({
    next: () => this.finishOnboardingSuccessfully(),
    error: (error: HttpErrorResponse) => {
      if (error.status === 503 && error.error?.dataSaved === true) {
        this.processingPending = true;
        this.errorMessage = error.error?.message ||
          'Your files were imported, but processing needs to be retried. Do not upload them again.';
        this.isCompletingSetup = false;
        return;
      }

      this.errorMessage = this.getErrorMessage(
        error,
        'Unable to finish setup. Your draft has been preserved. Please try again.'
      );
      this.isCompletingSetup = false;
    }
  });
}



retryProcessing(): void {
  if (this.isCompletingSetup || !this.processingPending) return;

  this.isCompletingSetup = true;
  this.errorMessage = '';
  this.authService.retryOnboardingProcessing().subscribe({
    next: () => this.finishOnboardingSuccessfully(),
    error: (error: HttpErrorResponse) => {
      this.errorMessage = this.getErrorMessage(
        error,
        'Processing could not finish yet. Your imported data is safe; retry again.'
      );
      this.isCompletingSetup = false;
    }
  });
}

private finishOnboardingSuccessfully(): void {
  const user = this.authService.getUser();
  if (user) {
    localStorage.setItem(
      'ecoroute_user',
      JSON.stringify({ ...user, isOnboardingComplete: true })
    );
  }
  this.onboardingDraft.reset();
  this.processingPending = false;
  this.router.navigate(['/dashboard']);
}


  private getErrorMessage(
    error: HttpErrorResponse,
    fallback: string
  ): string {
    const message = error.error?.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (error.status === 401 || error.status === 403) {
      return 'Your session has expired or is unauthorized. Please log in again.';
    }

    if (error.status === 409) {
      return 'A truck with this name already exists, or truck management is temporarily locked.';
    }

    return fallback;
  }
}
