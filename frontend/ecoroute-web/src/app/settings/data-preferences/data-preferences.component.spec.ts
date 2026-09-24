import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataPreferencesComponent } from './data-preferences.component';

describe('DataPreferencesComponent', () => {
  let component: DataPreferencesComponent;
  let fixture: ComponentFixture<DataPreferencesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataPreferencesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DataPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
