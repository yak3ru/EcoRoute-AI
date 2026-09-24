import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WasteDataComponent } from './waste-data.component';

describe('WasteDataComponent', () => {
  let component: WasteDataComponent;
  let fixture: ComponentFixture<WasteDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WasteDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WasteDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
