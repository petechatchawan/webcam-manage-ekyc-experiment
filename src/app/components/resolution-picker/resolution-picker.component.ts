import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { CameraManager } from 'src/app/lib/camera.manager';
import { STANDARD_RESOLUTIONS } from 'src/app/lib/constants/resolution.preset';
import { VideoResolutionPreset } from 'src/app/lib/types/resolution.types';

@Component({
  selector: 'app-resolution-picker',
  templateUrl: './resolution-picker.component.html',
  styleUrls: ['./resolution-picker.component.scss'],
})
export class ResolutionPickerComponent implements OnInit {
  resolutionSpecs = STANDARD_RESOLUTIONS;
  portraitPresets: VideoResolutionPreset[] = [];
  landscapePresets: VideoResolutionPreset[] = [];
  currentResolution?: VideoResolutionPreset;
  selectedOrientation: 'portrait' | 'landscape' = 'portrait';
  readonly activeTabClass = 'px-4 py-2 rounded-md bg-white shadow text-primary transition-all';
  readonly inactiveTabClass = 'px-4 py-2 text-gray-600 hover:text-gray-800 transition-all';
  isLandscape = false;
  constructor(
    private modalCtrl: ModalController,
    private cameraManager: CameraManager,
    private toastCtrl: ToastController
  ) { }

  async ngOnInit() {
    await this.initializeResolutions();
  }

  private async initializeResolutions() {
    try {
      // Get current device ID
      const currentDevice = this.cameraManager.getCurrentCameraDevice();
      if (!currentDevice?.deviceId) {
        console.error('No current camera device found');
        return;
      }

      // Check capabilities
      let capabilities = this.cameraManager.getCapabilities();
      if (!capabilities) {
        await this.cameraManager.checkCameraCapabilities();
        capabilities = this.cameraManager.getCapabilities();
      }

      // Get resolutions for current device
      const currentDeviceResolutions = capabilities?.deviceResolutions?.[currentDevice.deviceId];
      if (!currentDeviceResolutions?.supportedResolutions?.length) {
        console.error('No supported resolutions found for current device');
        return;
      }

      // Filter resolutions by orientation for current device only
      this.portraitPresets = currentDeviceResolutions.supportedResolutions
        .filter(res => res.orientations?.portrait)
        .map(res => res.preset);

      this.landscapePresets = currentDeviceResolutions.supportedResolutions
        .filter(res => res.orientations?.landscape)
        .map(res => res.preset);

      // Set current resolution
      const currentConfig = this.cameraManager.getCurrentCameraConfig();
      this.currentResolution = currentConfig.resolution?.preset;
    } catch (error) {
      console.error('Failed to initialize resolutions:', error);
    }
  }


  async selectResolution(preset: VideoResolutionPreset) {
    try {
      await this.cameraManager.applyConfigChanges({ resolution: STANDARD_RESOLUTIONS[preset] }, true);
      this.dismiss(preset);
    } catch (error) {
      console.error('Failed to change resolution:', error);
      throw error;
    }
  }

  dismiss(data?: VideoResolutionPreset) {
    this.modalCtrl.dismiss(data);
  }

  getCurrentPresets(): VideoResolutionPreset[] {
    return this.selectedOrientation === 'portrait'
      ? this.portraitPresets
      : this.landscapePresets;
  }

  getCardClass(preset: string): string {
    return `
      bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200
      ${this.isCurrentResolution(preset) ? 'ring-2 ring-primary' : ''}
      cursor-pointer
    `;
  }

  getQualityLevel(preset: string): string {
    const { width, height } = this.resolutionSpecs[preset as VideoResolutionPreset];
    const pixels = width * height;
    if (pixels >= 1920 * 1080) return 'HD';
    if (pixels >= 1280 * 720) return 'SD';
    return 'Basic';
  }

  getQualityBadgeClass(preset: string): string {
    const baseClass = 'text-white';
    const { width, height } = this.resolutionSpecs[preset as VideoResolutionPreset];
    const pixels = width * height;

    if (pixels >= 1920 * 1080) return `${baseClass} bg-green-500`;
    if (pixels >= 1280 * 720) return `${baseClass} bg-yellow-500`;
    return `${baseClass} bg-gray-500`;
  }

  calculateAspectRatio(width: number, height: number): string {
    const gcd = this.getGCD(width, height);
    return `${width / gcd}:${height / gcd}`;
  }

  getAspectRatioPadding(preset: string): string {
    const { width, height } = this.resolutionSpecs[preset as VideoResolutionPreset];
    return `${(height / width) * 100}%`;
  }

  private getGCD(a: number, b: number): number {
    return b === 0 ? a : this.getGCD(b, a % b);
  }

  isCurrentResolution(preset: string): boolean {
    return this.currentResolution === preset;
  }

  private async showErrorToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'Retry',
          handler: () => { }
        }
      ]
    });
    await toast.present();
  }
}