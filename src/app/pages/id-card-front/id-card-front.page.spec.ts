import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdCardFrontPage } from './id-card-front.page';

describe('IdCardFrontPage', () => {
  let component: IdCardFrontPage;
  let fixture: ComponentFixture<IdCardFrontPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(IdCardFrontPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
