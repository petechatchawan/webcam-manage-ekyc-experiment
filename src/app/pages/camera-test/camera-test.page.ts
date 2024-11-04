import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActionSheetController, IonContent, ModalController, NavController, Platform, ToastController } from '@ionic/angular';
import { Subscription, fromEvent } from 'rxjs';
import { ImagePreviewComponent } from 'src/app/components/image-preview/image-preview.component';
import { CameraErrorCode, CameraManager, FacingMode, ImageFormat, VideoResolutionPreset } from 'src/app/lib/camera.manager';
import { STANDARD_RESOLUTIONS } from 'src/app/lib/constants/resolution.preset';
import { Resolution } from 'src/app/lib/types/resolution.types';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-camera-test',
  templateUrl: './camera-test.page.html',
  styleUrls: ['./camera-test.page.scss'],
})
export class CameraTestPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild(IonContent) content!: IonContent;

  private subscriptions: Subscription[] = [];
  private resumeSubscription?: Subscription;

  isLoading = false;
  error: string | null = null;
  isCameraReady = false;
  isCapturing = false;
  hasMultipleCameras = false;  // สถานะว่ามีกล้องหลายตัวหรือไม่
  currentFacingMode = FacingMode.Front;
  currentDevice: MediaDeviceInfo | null = null;
  currentResolution: Resolution | null = null;
  metrics = {
    frameRate: 0,
    startupTime: 0
  };

  constructor(
    public themeService: ThemeService,
    private cameraManager: CameraManager,
    private actionSheetCtrl: ActionSheetController,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private platform: Platform,
    private zone: NgZone
  ) { }

  ngOnInit() {
    this.setupResumeSubscription();
    this.platform.ready().then(() => {
      const capabilities = this.cameraManager.getCapabilities();
      if (!capabilities) {
        // ถ้ายังไม่เคยตรวจสอบความสามารถ ให้กลับไปหน้า device check
        this.navCtrl.navigateRoot('/device-check');
        return;
      }

      console.log('Platform ready, initializing camera...');
      this.initializeCamera();
    });
  }

  ngAfterViewInit() {
    try {
      if (!this.videoElement || !this.canvasElement) {
        throw new Error('Video element or canvas element not found');
      }

      // เพิ่ม visibility change listener
      this.subscriptions.push(
        fromEvent(document, 'visibilitychange').subscribe(() => {
          this.handleVisibilityChange();
        })
      );
    } catch (error: any) {
      this.handleCameraError('ngAfterViewInit', error.message);
    }
  }

  ngOnDestroy() {
    this.cleanup();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.resumeSubscription?.unsubscribe();
  }

  private setupResumeSubscription() {
    // รับ event เมื่อแอพกลับมาทำงาน
    this.resumeSubscription = this.platform.resume.subscribe(() => {
      this.zone.run(() => {
        console.log('App resumed, reinitializing camera...');
        this.reinitializeCamera();
      });
    });
  }

  private handleVisibilityChange() {
    if (document.hidden) {
      // หน้าเว็บถูกซ่อน (เช่น switch tab)
      this.stopCamera();
    } else {
      // หน้าเว็บกลับมาแสดงผล
      this.reinitializeCamera();
    }
  }

  private async reinitializeCamera() {
    console.log('Reinitializing camera...');
    if (this.error || !this.isCameraReady) {
      await this.cleanup();
      await this.initializeCamera();
    } else {
      // ถ้ากล้องทำงานอยู่แล้ว ให้ตรวจสอบสถานะ
      const isActive = await this.checkCameraActive();
      if (!isActive) {
        await this.cleanup();
        await this.initializeCamera();
      }
    }
  }

  private async checkCameraActive(): Promise<boolean> {
    if (!this.cameraManager || !this.currentDevice) return false;

    try {
      const track = this.cameraManager.getCurrentStream()?.getVideoTracks()[0];
      return track?.readyState === 'live';
    } catch (error) {
      console.error('Error checking camera state:', error);
      return false;
    }
  }

  private stopCamera() {
    if (this.cameraManager) {
      this.cameraManager.stopCamera();
    }
  }

  private setupCameraEvents() {
    if (!this.cameraManager) return;

    // Event listener สำหรับทุก events
    this.hasMultipleCameras = this.cameraManager.hasMultipleCameras();
    this.cameraManager.on('ALL', (response) => {
      if (response.status === 'error') {
        this.handleCameraError(response.error?.code, response.error?.message);
      }
    });

    // Event listener สำหรับเมื่อกล้องเริ่มทำงานสำเร็จ
    this.cameraManager.on('START_CAMERA_SUCCESS', () => {
      this.zone.run(() => {
        this.isCameraReady = true;
        this.isLoading = false;
        this.updateMetrics();
        console.log(this.cameraManager.getCurrentCameraDevice());
        console.log(this.cameraManager.getCurrentResolution());

        this.currentDevice = this.cameraManager.getCurrentCameraDevice();
        this.currentResolution = this.cameraManager.getCurrentResolution() || { width: 0, height: 0, aspectRatio: 0, name: '' };
      });
    });

    // Event listener สำหรับเมื่อกล้องหยุดทำงาน
    this.cameraManager.on('STOP_CAMERA', () => {
      this.zone.run(() => {
        this.isCameraReady = false;
      });
    });
  }

  private updateMetrics() {
    if (!this.cameraManager) return;

    // อัพเดท metrics ทุกๆ 1 วินาที
    const updateInterval = setInterval(() => {
      if (this.cameraManager && this.isCameraReady) {
        const track = this.cameraManager.getCurrentStream()?.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings();

          this.metrics = {
            frameRate: Math.round(settings.frameRate || 0),
            startupTime: Math.round(this.cameraManager.getMetrics().startupTime || 0)
          };
        }
      } else {
        clearInterval(updateInterval);
      }
    }, 1000);

    // เก็บ interval ไว้ cleanup
    this.subscriptions.push(
      new Subscription(() => {
        clearInterval(updateInterval);
      })
    );
  }


  async initializeCamera() {
    if (this.isLoading) {
      console.log('Camera is already loading');
      return;
    }

    try {
      this.isLoading = true;
      this.error = null;

      const capabilities = this.cameraManager.getCapabilities();
      if (!capabilities || !capabilities.isSupported) {
        throw new Error('Camera not supported or not checked');
      }

      // รอสร้าง elements สำหรับการใช้งาน
      await this.waitForElements();

      // จัดการเกี่ยวกับ event ของกล้อง
      this.setupCameraEvents();

      // ตั้งค่า configuration
      this.cameraManager.setCurrentCameraConfiguration({
        videoElement: this.videoElement.nativeElement,
        canvasElement: this.canvasElement.nativeElement,
        facingMode: this.currentFacingMode,
        resolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.SQUARE_FHD],
        fallbackResolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.SQUARE_HD],
        mirror: this.currentFacingMode === FacingMode.Front,
        autoSwapResolution: true
      });


      // เริ่มกล้องด้วยความละเอียดที่แนะนำ
      await this.cameraManager.startCameraWithResolution(true);
    } catch (err: any) {
      this.handleCameraError('INITIALIZATION_ERROR', err.message);
    } finally {
      this.isLoading = false;
    }
  }

  private async waitForElements(): Promise<void> {
    return new Promise((resolve) => {
      const checkElements = () => {
        if (this.videoElement && this.canvasElement) {
          resolve();
        } else {
          setTimeout(checkElements, 100);
        }
      };
      checkElements();
    });
  }


  async handleSwitchCamera() {
    if (!this.cameraManager || this.isLoading) return;

    this.isLoading = true;
    try {
      await this.cameraManager.switchCamera();
      this.currentFacingMode = this.currentFacingMode === FacingMode.Front ? FacingMode.Back : FacingMode.Front;
      this.currentDevice = this.cameraManager.getCurrentCameraDevice();
    } catch (err) {
      this.handleCameraError('SWITCH_CAMERA_ERROR', 'Failed to switch camera');
    } finally {
      this.isLoading = false;
    }
  }

  // ปรับปรุง handleCapture method
  async handleCapture() {
    if (!this.cameraManager || !this.isCameraReady || this.isLoading) return;

    try {
      // แสดง effect การถ่ายภาพ
      this.isCapturing = true;
      const image = await this.cameraManager.captureImage({
        quality: 0.8,
        base64: true,
        scale: 1.0,
        format: ImageFormat.JPEG,
        mirror: this.currentFacingMode === FacingMode.Front
      });

      if (image) {
        this.showCapturePreview(image);
      }

    } catch (err) {
      this.handleCameraError('CAPTURE_ERROR', 'Failed to capture image');
    } finally {
      // ซ่อน effect การถ่ายภาพหลังจาก delay เล็กน้อย
      setTimeout(() => {
        this.isCapturing = false;
      }, 200);
    }
  }

  async presentResolutionPicker() {
    const capabilities = this.cameraManager.getCapabilities();
    if (!capabilities) return;

    const buttons = capabilities.supportedResolutions.map(resolution => ({
      text: STANDARD_RESOLUTIONS[resolution].name,
      handler: () => this.changeResolution(resolution)
    }));

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Select Resolution',
      buttons: [...buttons, { text: 'Cancel', role: 'cancel' }]
    });

    await actionSheet.present();
  }

  private async changeResolution(preset: VideoResolutionPreset) {
    try {
      this.isLoading = true;
      this.cameraManager.setResolution(STANDARD_RESOLUTIONS[preset]);
      await this.cameraManager.startCameraWithResolution(true);
    } catch (error) {
      console.error('Resolution change failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // ปรับปรุง showCapturePreview
  private async showCapturePreview(image: { uri: string, base64?: string }) {
    const modal = await this.modalCtrl.create({
      component: ImagePreviewComponent,
      componentProps: {
        imageData: image.base64 || image.uri,
        timestamp: new Date().toISOString()
      },
      cssClass: 'image-preview-modal',
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    await modal.present();
    const { data } = await modal.onWillDismiss();
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  async retryInitialization() {
    await this.cleanup();
    await this.initializeCamera();
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
          handler: () => {
            this.retryInitialization();
          }
        }
      ]
    });
    await toast.present();
  }

  private handleCameraError(code?: string, message?: string) {
    this.isLoading = false;
    let errorMessage = 'An error occurred with the camera';

    switch (code) {
      case CameraErrorCode.PERMISSION_DENIED:
        errorMessage = 'Camera permission was denied. Please enable camera access and refresh the page.';
        break;
      case CameraErrorCode.DEVICE_NOT_FOUND:
        errorMessage = 'No camera device was found. Please connect a camera and refresh the page.';
        break;
      case CameraErrorCode.BROWSER_NOT_COMPATIBLE:
        errorMessage = 'Your browser is not compatible with the camera features. Please try using a different browser.';
        break;
      default:
        errorMessage = message || errorMessage;
    }

    this.error = errorMessage;
    this.isCameraReady = false;

    // แสดง toast error
    this.showErrorToast(errorMessage);
  }

  private async cleanup() {
    await this.cameraManager.stopCamera();
    this.cameraManager.destroy();
    this.isCameraReady = false;
    this.error = null;
  }


  // ======= Until here =======

  goBack() {
    this.navCtrl.back();
  }
}