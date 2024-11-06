import { UAInfo } from 'src/app/lib/ua-info';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(private uaInfo: UAInfo) {
    this.uaInfo.setUserAgent(navigator.userAgent);
  }
}
