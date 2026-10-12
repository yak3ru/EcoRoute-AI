
import { Injectable } from '@angular/core';

export interface OnboardingArea {
  areaName: string;
  populationDensity: number;
  latitude: number;
  longitude: number;
}

export interface OnboardingWasteRecord {
  areaName: string;
  collectionDate: string;
  wasteType: string;
  weightKg: number;
  status: string;
}

export interface OnboardingTruck {
  id: number;
  vehicleName: string;
  capacityKg: number;
  maximumRouteDistanceKm: number;
  collectionStartTime: string;
  collectionEndTime: string;
  status: string;
}

interface OnboardingDraft {
  areas: OnboardingArea[];
  wasteRecords: OnboardingWasteRecord[];
  trucks: OnboardingTruck[];
  currentStep: number;
}

@Injectable({
  providedIn: 'root'
})
export class OnboardingDraftService {
  private readonly storageKey = 'ecoroute_onboarding_draft';

  private _areas: OnboardingArea[] = [];
  private _wasteRecords: OnboardingWasteRecord[] = [];
  private _trucks: OnboardingTruck[] = [];
  private _currentStep = 1;

  constructor() {
    this.restoreDraft();
  }

  get areas(): OnboardingArea[] {
    return this._areas;
  }

  set areas(value: OnboardingArea[]) {
    this._areas = value;
    this.saveDraft();
  }

  get wasteRecords(): OnboardingWasteRecord[] {
    return this._wasteRecords;
  }

  set wasteRecords(value: OnboardingWasteRecord[]) {
    this._wasteRecords = value;
    this.saveDraft();
  }

  get trucks(): OnboardingTruck[] {
    return this._trucks;
  }

  set trucks(value: OnboardingTruck[]) {
    this._trucks = value;
    this.saveDraft();
  }

  get currentStep(): number {
    return this._currentStep;
  }

  set currentStep(value: number) {
    this._currentStep = value;
    this.saveDraft();
  }

  private saveDraft(): void {
    try {
      const draft: OnboardingDraft = {
        areas: this._areas,
        wasteRecords: this._wasteRecords,
        trucks: this._trucks,
        currentStep: this._currentStep
      };

      sessionStorage.setItem(
        this.storageKey,
        JSON.stringify(draft)
      );
    } catch (error) {
      console.error('Unable to save onboarding draft:', error);
    }
  }

  private restoreDraft(): void {
    try {
      const saved = sessionStorage.getItem(this.storageKey);

      if (!saved) {
        return;
      }

      const draft: OnboardingDraft = JSON.parse(saved);

      this._areas = Array.isArray(draft.areas)
        ? draft.areas
        : [];

      this._wasteRecords = Array.isArray(draft.wasteRecords)
        ? draft.wasteRecords
        : [];

      this._trucks = Array.isArray(draft.trucks)
        ? draft.trucks
        : [];

      this._currentStep =
        Number.isInteger(draft.currentStep) &&
        draft.currentStep >= 1 &&
        draft.currentStep <= 2
          ? draft.currentStep
          : 1;
    } catch (error) {
      console.error('Unable to restore onboarding draft:', error);

      this._areas = [];
      this._wasteRecords = [];
      this._trucks = [];
      this._currentStep = 1;
    }
  }

  reset(): void {
    this._areas = [];
    this._wasteRecords = [];
    this._trucks = [];
    this._currentStep = 1;

    try {
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Unable to clear onboarding draft:', error);
    }
  }
}
