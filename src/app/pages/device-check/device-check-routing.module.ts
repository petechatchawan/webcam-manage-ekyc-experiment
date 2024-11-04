import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DeviceCheckPage } from './device-check.page';

const routes: Routes = [
  {
    path: '',
    component: DeviceCheckPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DeviceCheckPageRoutingModule {}
