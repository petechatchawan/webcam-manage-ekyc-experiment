import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-image-preview',
  templateUrl: './image-preview.component.html',
  styleUrls: ['./image-preview.component.scss'],
})
export class ImagePreviewComponent {
  @Input() imageData!: string;
  @Input() timestamp!: string;

  constructor(private modalCtrl: ModalController) { }

  dismiss(save: boolean) {
    this.modalCtrl.dismiss({
      save
    });
  }
}