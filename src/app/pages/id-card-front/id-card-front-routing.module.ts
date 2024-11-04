import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { IdCardFrontPage } from './id-card-front.page';

const routes: Routes = [
  {
    path: '',
    component: IdCardFrontPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IdCardFrontPageRoutingModule {}
