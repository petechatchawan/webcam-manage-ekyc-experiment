import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CameraTestPage } from './camera-test.page';

const routes: Routes = [
  {
    path: '',
    component: CameraTestPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CameraTestPageRoutingModule {}
