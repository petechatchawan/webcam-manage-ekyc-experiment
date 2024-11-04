import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CameraManager } from 'src/app/lib/camera.manager';

interface DeviceCheck {
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'success' | 'error';
  errorMessage?: string;
}

@Component({
  selector: 'app-device-check',
  templateUrl: './device-check.page.html',
  styleUrls: ['./device-check.page.scss'],
})
export class DeviceCheckPage implements OnInit {

  private readonly checks = new BehaviorSubject<DeviceCheck[]>([
    {
      name: 'Browser Compatibility',
      description: 'Checking browser support for required features',
      status: 'pending'
    },
    {
      name: 'Camera Access',
      description: 'Verifying camera permissions and availability',
      status: 'pending'
    },
    {
      name: 'Camera Resolution Availability',
      description: 'Checking camera resolution availability',
      status: 'pending'
    },
    {
      name: 'Device Performance',
      description: 'Checking device capabilities',
      status: 'pending'
    }
  ]);

  checks$ = this.checks.asObservable();
  isChecking = false;
  allChecksPassed = false;
  hasErrors = false;

  constructor(
    private cameraManager: CameraManager,
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    console.log("DeviceCheckPage ngOnInit");
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return 'ellipse-outline';
      case 'checking':
        return 'refresh';
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      default:
        return 'ellipse-outline';
    }
  }

  async startChecks() {
    this.isChecking = true;
    this.allChecksPassed = false;
    this.hasErrors = false;

    // Reset checks
    const initialChecks = this.checks.value.map(check => ({
      ...check,
      status: 'pending' as const,
      errorMessage: undefined
    }));

    this.checks.next(initialChecks);

    // Check browser compatibility
    await this.performCheck(0, async () => {
      const isCompatible = 'mediaDevices' in navigator;
      if (!isCompatible) {
        throw new Error('Your browser does not support required features');
      }
      return true;
    });

    // Check camera access
    await this.performCheck(1, async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        throw new Error('Camera access denied or not available');
      }
    });

    // Check device performance
    await this.performCheck(2, async () => {
      // Simple performance check (can be expanded)
      return await this.checkCamera();
    });

    // Check device performance
    await this.performCheck(3, async () => {
      // Simple performance check (can be expanded)
      const start = performance.now();
      await new Promise(resolve => setTimeout(resolve, 100));
      const end = performance.now();

      if (end - start > 200) {
        throw new Error('Device performance might be insufficient');
      }
      return true;
    });

    this.isChecking = false;
    this.updateStatus();
  }

  private async performCheck(index: number, checkFn: () => Promise<boolean>) {
    const currentChecks = [...this.checks.value];
    currentChecks[index].status = 'checking';
    this.checks.next(currentChecks);

    try {
      await checkFn();
      currentChecks[index].status = 'success';
    } catch (error: any) {
      currentChecks[index].status = 'error';
      currentChecks[index].errorMessage = error.message;
    }

    this.checks.next(currentChecks);
    await new Promise(resolve => setTimeout(resolve, 500)); // Add delay between checks
  }

  private updateStatus() {
    const currentChecks = this.checks.value;
    this.allChecksPassed = currentChecks.every(check => check.status === 'success');
    this.hasErrors = currentChecks.some(check => check.status === 'error');
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  // ============================= PRIVATE METHODS ===================================
  private async checkCamera(): Promise<boolean> {
    try {
      const result = await this.cameraManager.checkCameraCapabilities();
      if (!result) {
        throw new Error(this.cameraManager.getCapabilities()?.errorMessage || 'Camera check failed');
      }

      const capabilities = this.cameraManager.getCapabilities();
      if (!capabilities?.isSupported) {
        throw new Error('Camera not supported');
      }

      console.log('Camera check passed');
      console.log("Capabilities:", capabilities);

      return true;
    } catch (error: any) {
      throw new Error(`Camera check failed: ${error.message}`);
    }
  }
}
