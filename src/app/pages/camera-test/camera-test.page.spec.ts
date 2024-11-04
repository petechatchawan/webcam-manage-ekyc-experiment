import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CameraTestPage } from './camera-test.page';

describe('CameraTestPage', () => {
  let component: CameraTestPage;
  let fixture: ComponentFixture<CameraTestPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CameraTestPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
