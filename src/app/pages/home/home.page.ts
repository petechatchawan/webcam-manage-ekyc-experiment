import { CameraCapability, CameraManager } from 'src/app/lib/camera.manager';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../theme.service';
import { STANDARD_RESOLUTIONS, VideoResolutionPreset } from 'src/app/lib/types/resolution.types';

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
    await this.refreshCameraInfo();
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

  getResolutionTooltip(resolution: VideoResolutionPreset): string {
    const spec = this.RESOLUTION_SPECS[resolution];
    return `${spec.name} - ${spec.width}x${spec.height} (${spec.aspectRatio}:1)`;
  }

  goToWelcome() {
    this.router.navigate(['/welcome']);
  }
}