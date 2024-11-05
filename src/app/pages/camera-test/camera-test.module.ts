import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CameraTestPageRoutingModule } from './camera-test-routing.module';

import { CameraTestPage } from './camera-test.page';
import { ImagePreviewComponent } from 'src/app/components/image-preview/image-preview.component';
import { ResolutionPickerComponent } from 'src/app/components/resolution-picker/resolution-picker.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CameraTestPageRoutingModule
  ],
  declarations: [CameraTestPage, ImagePreviewComponent, ResolutionPickerComponent]
})
export class CameraTestPageModule { }
