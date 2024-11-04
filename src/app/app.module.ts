import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { CameraManager } from './lib/camera.manager';
import { UAInfo } from './lib/ua-info';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: UAInfo, useFactory: () => new UAInfo() },
    { provide: CameraManager, useFactory: () => new CameraManager() }
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
