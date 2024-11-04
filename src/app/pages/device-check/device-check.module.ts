import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DeviceCheckPageRoutingModule } from './device-check-routing.module';

import { DeviceCheckPage } from './device-check.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DeviceCheckPageRoutingModule
  ],
  declarations: [DeviceCheckPage]
})
export class DeviceCheckPageModule {}
