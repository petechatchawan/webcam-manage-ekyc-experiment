import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { IdCardFrontPageRoutingModule } from './id-card-front-routing.module';

import { IdCardFrontPage } from './id-card-front.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    IdCardFrontPageRoutingModule
  ],
  declarations: [IdCardFrontPage]
})
export class IdCardFrontPageModule {}
