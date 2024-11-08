
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CameraCapability, CameraManager } from 'src/app/lib/camera.manager';
import { STANDARD_RESOLUTIONS } from 'src/app/lib/constants/resolution.preset';
import { VideoResolutionPreset } from 'src/app/lib/types/resolution.types';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  isLoading = false;
  hasError = false;
  errorMessage = '';
  noDevicesFound = false;
  cameraCapability: CameraCapability | null = null;
  RESOLUTION_SPECS = STANDARD_RESOLUTIONS;

  constructor(
    public themeService: ThemeService,
    private cameraManager: CameraManager,
    private readonly router: Router
  ) { }

  async ngOnInit() {
    setTimeout(async () => {
      await this.refreshCameraInfo();
    }, 1000);
  }

  async refreshCameraInfo() {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';
    this.noDevicesFound = false;

    try {
      // ดึงข้อมูล capabilities ที่มีอยู่
      this.cameraCapability = this.cameraManager.getCapabilities();
      if (!this.cameraCapability || !this.cameraCapability.isSupported) {
        await this.goToDeviceCheck();
        return;
      }

      // ถ้ามี error message
      if (this.cameraCapability.errorMessage) {
        this.hasError = true;
        this.errorMessage = this.cameraCapability.errorMessage;
        return;
      }

      // ตรวจสอบว่ามีอุปกรณ์หรือไม่
      if (!this.cameraCapability.availableDevices?.length) {
        this.noDevicesFound = true;
        return;
      }

    } catch (error) {
      console.error('Error checking camera capabilities:', error);
      this.hasError = true;
      this.errorMessage = 'Failed to check camera capabilities. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async goToDeviceCheck() {
    try {
      // ล้าง capabilities เดิม (ถ้ามี)
      await this.cameraManager.destroy();
      // ไปหน้า device check
      await this.router.navigate(['/device-check']);
    } catch (error) {
      console.error('Error navigating to device check:', error);
    }
  }

  getResolutionTooltip(preset: VideoResolutionPreset): string {
    const spec = STANDARD_RESOLUTIONS[preset];
    return `${spec.name} (${spec.width}x${spec.height})`;
  }

  isCurrentOrientation(resolution: {
    preset: VideoResolutionPreset;
    orientations: { landscape: boolean; portrait: boolean; }
  }): boolean {
    const currentConfig = this.cameraManager.getCurrentCameraConfig();
    return currentConfig.resolution?.preset === resolution.preset;
  }

  isRecommendedResolution(preset: VideoResolutionPreset): boolean {
    const cameraCapability = this.cameraManager.getCapabilities();
    if (!cameraCapability) return false;
    return preset === cameraCapability.recommendedResolution;
  }

  // Helper method สำหรับแสดงชื่อ aspect ratio ที่สวยงาม
  getAspectRatioDisplay(ratio: number): string {
    if (ratio === 16 / 9) return '16:9';
    if (ratio === 4 / 3) return '4:3';
    if (ratio === 1) return '1:1';
    return ratio.toFixed(2) + ':1';
  }

  goToWelcome() {
    this.router.navigate(['/welcome']);
  }
}