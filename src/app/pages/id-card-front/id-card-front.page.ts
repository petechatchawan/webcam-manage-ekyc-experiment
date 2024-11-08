import { ImageProcessingService } from './../../services/image-processing.service';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, NavController, Platform, ToastController } from '@ionic/angular';
import { BehaviorSubject, fromEvent, Subject, Subscription, timer } from 'rxjs';
import { CameraDeviceSelector } from 'src/app/lib/camera-devices-selector';
import { CameraErrorCode, CameraManager, ImageFormat, CapturedImage } from 'src/app/lib/camera.manager';
import { CropPresets } from 'src/app/lib/constants/crop-preset';
import { STANDARD_RESOLUTIONS } from 'src/app/lib/constants/resolution.preset';
import { ENG_FAST_MODEL, THA_FAST_MODEL } from 'src/app/lib/constants/tesseract';
import { FacingMode } from 'src/app/lib/types/camera.types';
import { ProcessedOcrFrame } from 'src/app/lib/types/ocr.types';
import { ProcessingState } from 'src/app/lib/types/processing.state.types';
import { VideoResolutionPreset } from 'src/app/lib/types/resolution.types';
import { UAInfo } from 'src/app/lib/ua-info';
import { CardRegExpService } from 'src/app/services/card-reg-exp.service';
import { OcrService } from 'src/app/services/ocr.service';
import { DetectionResult, YoloService } from './../../services/yolo.service';
declare var cv: any;

interface ProcessingResult {
  state: ProcessingState;
  yoloResult: DetectionResult | null;
  ocrResult: ProcessedOcrFrame | null;
  processingTime: number;
}

interface OCRState {
  isLoading: boolean,
  error: string | null,
  isCameraReady: boolean,
  isProcessing: boolean,
  isCardDetected: boolean,
  processingTime: string,
  lastProcessedResult: any,
  remainingTime: number,
}

@Component({
  selector: 'app-id-card-front',
  templateUrl: './id-card-front.page.html',
  styleUrls: ['./id-card-front.page.scss'],
})
export class IdCardFrontPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  // State Management
  private timerSubscription: Subscription | null = null;
  private readonly subscriptions: Subscription[] = [];
  private readonly destroy$ = new Subject<void>();
  public readonly yoloResult$ = new BehaviorSubject<DetectionResult | null>(null);

  // UI State
  public readonly state: OCRState = {
    isLoading: false,
    error: null as string | null,
    isCameraReady: false,
    isProcessing: false,
    isCardDetected: false,
    processingTime: '',
    lastProcessedResult: null,
    remainingTime: 30,
  };

  // Configuration
  private readonly config = {
    cropPresets: CropPresets[3],
    mirrorMode: false,
    scaleFactor: 0.65,
    minimumConfidenceScore: 0.7,
    validCardDimensions: {
      minWidth: 700,
      maxWidth: 1200,
      minHeight: 350,
      maxHeight: 600,
    },
  };

  constructor(
    private cameraManager: CameraManager,
    private ocrService: OcrService,
    private yoloService: YoloService,
    private imageProcessingService: ImageProcessingService,
    private cardRegExpService: CardRegExpService,
    private uaInfo: UAInfo,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private platform: Platform,
    private zone: NgZone
  ) { }

  // Lifecycle Methods
  ngOnInit() {
    // this.setupResumeSubscription();
    this.platform.ready().then(async () => {
      const capabilities = this.cameraManager.getCapabilities();
      if (!capabilities) {
        this.navCtrl.navigateRoot('/device-check');
        return;
      }

      await this.registerCameraEventHandlers();
      await this.initializeCamera();
    });
  }

  async ngAfterViewInit() {
    try {
      if (!this.videoElement || !this.canvasElement) {
        throw new Error('Video element or canvas element not found');
      }

      // เพิ่ม visibility change listener
      this.subscriptions.push(
        fromEvent(document, 'visibilitychange').subscribe(() => {
          // this.handleVisibilityChange();
        })
      );
    } catch (error: any) {
      await this.handleError('ngAfterViewInit', error.message);
    }
  }

  ngOnDestroy() {
    this.cleanup();
  }

  /**
  * Initialize camera with proper error handling and state management
  */
  private async initializeCamera(): Promise<void> {
    if (this.state.isLoading) return;

    try {
      this.state.isLoading = true;
      this.state.error = null;

      await this.setupOcrAndYolo();
      await this.setupCameraPermissions();
      await this.setupInitialCamera();
    } catch (error: any) {
      await this.handleError('CAMERA_INIT_ERROR', error);
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   *
   *  Initialize OCR and YOLO
   *
   */
  private async setupOcrAndYolo(): Promise<void> {
    try {
      await Promise.all([
        this.ocrService.initializeOcrClient(ENG_FAST_MODEL),
        this.yoloService.initialize()
      ]);
    } catch (error) {
      throw new Error('Failed to initialize OCR/YOLO systems');
    }
  }

  /**
   * Check and request camera permissions
   */
  private async setupCameraPermissions(): Promise<void> {
    try {
      const hasPermission = await this.cameraManager.hasPermissions();
      if (!hasPermission) {
        const isGranted = await this.cameraManager.requestPermission();
        if (!isGranted) {
          throw new Error('Camera permission denied');
        }
      }

      // if granted, get all camera devices
      await this.cameraManager.getCameraDevices();
    } catch (error: any) {
      await this.handleError('Camera Permissions Error', error.message);
    }
  }

  /**
  * Setup initial camera configuration
  */
  private async setupInitialCamera(): Promise<void> {
    const cameraDeviceSelector = new CameraDeviceSelector();
    const allDevices = await this.cameraManager.getCameraDevices();
    const selectedCamera = await cameraDeviceSelector.selectCamera(allDevices, FacingMode.Back);
    if (!selectedCamera) {
      throw new Error('No camera device found');
    }

    // ตั้งค่าการใช้งานกล้อง
    await this.waitForElements();

    // ตั้งค่าการใช้งานกล้อง
    this.config.mirrorMode = this.uaInfo.isDesktop();
    this.cameraManager.setCurrentCameraConfiguration({
      videoElement: this.videoElement.nativeElement,
      canvasElement: this.canvasElement.nativeElement,
      enableAudio: false,
      selectedDevice: selectedCamera,
      resolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.FHD],
      fallbackResolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.HD],
      autoSwapResolution: this.uaInfo.isMobile() || this.uaInfo.isTablet(),
      mirror: this.config.mirrorMode
    });

    // เริ่มกล้องด้วยความละเอียดที่แนะนำ
    await this.cameraManager.startCameraWithResolution(true);
  }

  /**
   * Setup camera events
   */
  private async registerCameraEventHandlers() {
    // Event listener สำหรับเมื่อมีข้อผิดพลาด
    this.cameraManager.on('ALL', async (response) => {
      if (response.status === 'error') {
        await this.handleError(response.error?.code, response.error?.message);
      }
    });

    // Event listener สำหรับเมื่อกล้องเริ่มทำงานสำเร็จ
    this.cameraManager.on('START_CAMERA_SUCCESS', () => {
      this.showToast('กล้องกำลังทำงาน...');
      this.zone.run(async () => {
        this.state.isCameraReady = true;
        this.state.isLoading = false;

        setTimeout(async () => {
          await this.startProcessing();
          this.startTimer();
        }, 500);
      });
    });

    // Event listener สำหรับเมื่อกล้องหยุดทำงาน
    this.cameraManager.on('STOP_CAMERA', () => {
      this.showToast('กล้องหยุดทำงาน...');
      this.zone.run(() => {
        this.state.isCameraReady = false;
      });
    });
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


  // =========================== TIMER ===============================

  private startTimer() {
    this.timerSubscription = timer(0, 1000).subscribe(() => {
      if (this.state.remainingTime > 0) {
        this.state.remainingTime--;
      } else {
        this.stopTimer();
        // หยุดการทำงาน
        // this.handlerOutOfTime();
      }
    });
  }

  private stopTimer() {
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = null;
    this.state.remainingTime = 0;
  }

  async startProcessing(): Promise<void> {
    if (this.state.isProcessing) {
      return;
    }

    try {
      await this.showToast('กําลังทำการตรวจจับบัตร...');
      this.state.isProcessing = true;
      await this.processNextFrame();
    } catch (error: any) {
      console.error('Start processing error:', error);
      await this.handleError('Startup Error', error.message);
    }
  }

  async stopProcessing(): Promise<void> {
    await this.showToast('การตรวจจับบัตรถูกยกเลิก');
    this.state.isProcessing = false;
    this.stopTimer();
  }

  private async processNextFrame(): Promise<void> {
    // ถ้าไม่ได้อยู่ในสถานะ processing ให้หยุดทำงาน
    if (!this.state.isProcessing) {
      return;
    }

    try {
      // 1. จับภาพ
      const capturedImage = await this.cameraManager.captureImage({
        base64: true,
        format: ImageFormat.JPEG,
        quality: 0.92,
        scale: this.config.scaleFactor,
        mirror: this.config.mirrorMode
      });

      // ตรวจสอบว่ายังอยู่ใน processing state และมีภาพที่จับได้
      if (!this.state.isProcessing || !capturedImage?.uri) {
        return;
      }


      // 2. ประมวลผลเฟรม
      const result = await this.processFrame(capturedImage);
      this.state.processingTime = result.processingTime.toFixed(2);
      console.log('Processing result:', result);

      // ตรวจสอบอีกครั้งว่ายังอยู่ใน processing state
      if (!this.state.isProcessing) {
        return;
      }

      // 3. จัดการผลลัพธ์
      await this.handleProcessingResult(result);

      // 4. ถ้ายังอยู่ใน processing state ให้ทำเฟรมถัดไป
      if (this.state.isProcessing) {
        await Promise.resolve().then(() => this.processNextFrame());
      }

    } catch (error: any) {
      console.error('Frame processing error:', error);
      await this.handleError('Processing Error', error.message);
    }
  }

  // Frame Processing Pipeline
  private async processFrame(capturedImage: CapturedImage): Promise<ProcessingResult> {
    const startTime = performance.now();

    try {
      const cropImage = await this.imageProcessingService.cropImage(capturedImage.uri, this.config.cropPresets.dimensions);
      const bitmap = await this.imageProcessingService.base64ToImageBitmap(cropImage);
      const hocr = await this.ocrService.getHOCR(bitmap);
      const parseResult = this.ocrService.parseHOCRContent(hocr, 'national');

      // validate id card
      const idCardFrame = await this.ocrService.validateIdCardFrame(
        parseResult,
        capturedImage.uri,
        startTime,
        this.videoElement,
        this.canvasElement
      );



      console.log('ID card frame:', idCardFrame);
      return this.createProcessingResult(idCardFrame.state, null, null, startTime);
    } catch (error) {
      return this.createProcessingResult(ProcessingState.FAILED, null, null, startTime);
    }
  }

  private updateYoloState(result: DetectionResult): void {
    console.log('Updating YOLO state...');
    console.log('Current state:', this.state);
    console.log('New result:', result);
    this.yoloResult$.next(result);
    this.state.processingTime = result.processingTimeMs.toFixed(2);
    console.log('Updated state:', this.state);
  }

  private isValidDetection(result: DetectionResult): boolean {
    const { confidence, dimensions, documentType } = result;
    const { minimumConfidenceScore, validCardDimensions } = this.config;

    return (
      confidence >= minimumConfidenceScore &&
      ['id_card', 'driving-license'].includes(documentType) &&
      dimensions.width >= validCardDimensions.minWidth &&
      dimensions.width <= validCardDimensions.maxWidth &&
      dimensions.height >= validCardDimensions.minHeight &&
      dimensions.height <= validCardDimensions.maxHeight
    );
  }

  private async handleProcessingResult(result: any): Promise<void> {
    if (!result || !this.state.isProcessing) return;

    const { state } = result;

    switch (state) {
      case ProcessingState.PASSED:
        console.log('Scan successful!');

        // detect document
        const img = cv.imread(this.canvasElement.nativeElement);
        const yoloResult = await this.yoloService.detectDocument(img);
        this.updateYoloState(yoloResult);

        await this.handleSuccessfulScan();
        break;

      case ProcessingState.INVALID_SIZE:
        // await this.showToast('Move the card closer to the camera');
        console.log("Move the card closer to the camera");
        break;

      case ProcessingState.TEXT_NOT_FOUND:
      case ProcessingState.TEXT_NOT_ENOUGH:
        // await this.showToast('Cannot read card text clearly');
        console.log("Cannot read card text clearly");
        break;

      case ProcessingState.INVALID_FORMAT:
        // await this.showToast('Invalid card format detected');
        console.log("Invalid card format detected");
        break;

      case ProcessingState.WORD_NOT_ENOUGH:
        // await this.showToast('Card text not fully visible');
        // console.log("Card text not fully visible");
        console.log("Card text not fully visible");
        break;
    }

    this.state.lastProcessedResult = result;
  }

  /**
   *
   *  Public Methods
   *
   */

  public async capturePhoto(): Promise<void> {
    await this.stopAllProcessing();
  }

  /**
   * Toggle Mirror Mode
   */
  public toggleMirrorMode(): void {
    this.config.mirrorMode = !this.config.mirrorMode;
    this.cameraManager.toggleMirror();
  }

  public async switchCamera(): Promise<void> {
    if (this.state.isLoading) return;

    try {
      this.state.isLoading = true;
      await this.cameraManager.switchCamera();
    } catch (error: any) {
      await this.handleError('SWITCH_CAMERA_ERROR', error);
    } finally {
      this.state.isLoading = false;
    }
  }

  public async retakePhoto(): Promise<void> {
    await this.reinitializeCamera();
  }

  private async reinitializeCamera() {
    if (this.state.error || !this.state.isCameraReady) {
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
    if (!this.cameraManager || !this.cameraManager.getCurrentCameraDevice()) {
      return false;
    }

    try {
      const track = this.cameraManager.getCurrentStream()?.getVideoTracks()[0];
      return track?.readyState === 'live';
    } catch (error) {
      console.error('Error checking camera state:', error);
      return false;
    }
  }

  async handleSuccessfulScan() {
    const result = this.yoloResult$.value;
    if (!result) {
      this.showToast('ไม่พบข้อมูลในรูปภาพ');
      return;
    }

    await this.stopProcessing();
    const alert = await this.alertCtrl.create({
      header: 'ตรวจจับสําเร็จ',
      message: `เอกสารประเภท: ${result.documentType} \n
        มีความแม่นยํา: ${result.confidence.toFixed(2)} \n
        และมีขนาด ${result.dimensions.width.toFixed(0)} x ${result.dimensions.height.toFixed(0)} px \n
        คุณต้องการลองสแกนใหม่อีกรอบหรือไม่?`,
      buttons: [
        {
          text: 'ยกเลิก',
          role: 'cancel',
          handler: () => {
            console.log('Confirm Cancel');
            this.navCtrl.back();
          }
        },
        {
          text: 'ยืนยัน',
          handler: async () => {
            // TODO: Handle confirmation
            // console.log('Confirmed OCR result:', result);
            await this.startProcessing();
          }
        }
      ]
    });

    await alert.present();
  }

  // =============== Private Methods ===============

  // Error Handling
  private async handleError(code?: string, error?: any): Promise<void> {
    this.state.isLoading = false;
    const errorMessage = this.getErrorMessage(code || 'UNKNOWN_ERROR', error.message);

    this.state.error = errorMessage;
    this.state.isCameraReady = false;

    await this.showToast(errorMessage);
  }

  private getErrorMessage(code: string, defaultMessage: string): string {
    const errorMessages = new Map<CameraErrorCode, string>([
      [CameraErrorCode.PERMISSION_DENIED, 'Camera permission denied. Please enable camera access.'],
      [CameraErrorCode.DEVICE_NOT_FOUND, 'No camera device found. Please connect a camera.'],
      [CameraErrorCode.BROWSER_NOT_COMPATIBLE, 'Browser not compatible with camera features.'],
    ]);

    return errorMessages.get(code as CameraErrorCode) || defaultMessage;
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1000,
      position: 'bottom',
      buttons: [{
        text: 'Retry',
        handler: () => this.retryInitialization()
      }]
    });

    await toast.present();
  }

  async retryInitialization() {
    await this.cleanup();
    await this.initializeCamera();
  }

  private calculateProcessingTime(startTimestamp: number): number {
    const endTime = performance.now();
    const processingTime = endTime - startTimestamp;
    return processingTime;
  }

  private async cleanup(): Promise<void> {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.yoloResult$.unsubscribe();
    await this.stopAllProcessing();
  }

  private async stopAllProcessing(): Promise<void> {
    this.state.isProcessing = false;
    await this.cameraManager.stopCamera();
    this.ocrService.destroyOcrClient();
    await this.showToast('Card detection cancelled');
  }

  // Utility Methods
  private createProcessingResult(
    state: ProcessingState,
    yoloResult: DetectionResult | null,
    ocrResult: ProcessedOcrFrame | null,
    startTime: number
  ): ProcessingResult {
    return {
      state,
      yoloResult,
      ocrResult,
      processingTime: performance.now() - startTime
    };
  }
}



