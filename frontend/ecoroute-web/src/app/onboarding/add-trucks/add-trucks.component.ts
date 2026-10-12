
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
  imports: [CommonModule, FormsModule],
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
  nextTruckId = 1;
  errorMessage = '';
  successMessage = '';

  constructor(private router: Router) {}

  submitTruck(): void {
    this.errorMessage = '';
    this.successMessage = '';

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

    const truckData = {
      vehicleName: name,
      capacityKg: this.capacityKg,
      maximumRouteDistanceKm: this.maximumRouteDistanceKm,
      collectionStartTime: this.collectionStartTime,
      collectionEndTime: this.collectionEndTime,
      status: 'Available'
    };

    if (this.editingTruckId !== null) {
      this.trucks = this.trucks.map(truck =>
        truck.id === this.editingTruckId
          ? { ...truck, ...truckData }
          : truck
      );

      this.successMessage = `${name} updated successfully.`;
    } else {
      this.trucks = [
        ...this.trucks,
        {
          id: this.nextTruckId++,
          ...truckData
        }
      ];

      this.successMessage = `${name} added successfully.`;
    }

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
    const truck = this.trucks.find(item => item.id === id);

    if (!truck) {
      return;
    }

    this.trucks = this.trucks.filter(item => item.id !== id);

    if (this.editingTruckId === id) {
      this.resetForm();
    }

    this.successMessage = `${truck.vehicleName} deleted from the list.`;
    this.errorMessage = '';
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
    if (this.trucks.length === 0) {
      this.errorMessage = 'Please add at least one truck before continuing.';
      return;
    }

    console.log('Trucks prepared for onboarding:', this.trucks);

    // Connect this action to your onboarding completion API when ready.
    this.successMessage =
      'Your truck list is ready. Database saving is not connected yet.';
  }
}
