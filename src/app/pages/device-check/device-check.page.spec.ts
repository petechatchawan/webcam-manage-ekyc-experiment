import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceCheckPage } from './device-check.page';

describe('DeviceCheckPage', () => {
  let component: DeviceCheckPage;
  let fixture: ComponentFixture<DeviceCheckPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DeviceCheckPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
