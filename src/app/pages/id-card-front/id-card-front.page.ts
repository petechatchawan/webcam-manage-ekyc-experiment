import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, LoadingController, NavController, Platform, ToastController } from '@ionic/angular';
import { BehaviorSubject, fromEvent, Subject, Subscription } from 'rxjs';
import { CameraDeviceSelector } from 'src/app/lib/camera-devices-selector';
import { CameraErrorCode, CameraManager, CapturedImage, ImageFormat } from 'src/app/lib/camera.manager';
import { CropPresets } from 'src/app/lib/constants/crop-preset';
import { STANDARD_RESOLUTIONS } from 'src/app/lib/constants/resolution.preset';
import { THA_FAST_MODEL } from 'src/app/lib/constants/tesseract';
import { FacingMode } from 'src/app/lib/types/camera.types';
import { CropPreset } from 'src/app/lib/types/crop.types';
import { ProcessedOcrFrame } from 'src/app/lib/types/ocr.types';
import { ProcessingState } from 'src/app/lib/types/processing.state.types';
import { VideoResolutionPreset } from 'src/app/lib/types/resolution.types';
import { UAInfo } from 'src/app/lib/ua-info';
import { CardRegExpService, HOCRResult } from 'src/app/services/card-reg-exp.service';
import { ImageProcessingService } from 'src/app/services/image-processing.service';
import { OcrService } from 'src/app/services/ocr.service';
import { YoloService } from 'src/app/services/yolo.service';
declare var cv: any;

@Component({
  selector: 'app-id-card-front',
  templateUrl: './id-card-front.page.html',
  styleUrls: ['./id-card-front.page.scss'],
})
export class IdCardFrontPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  private predictionInterval?: any;


  constructor(
    private cameraManager: CameraManager,
    private imageProcessingService: ImageProcessingService,
    private ocrService: OcrService,
    private yoloService: YoloService,
    private cardRegExpService: CardRegExpService,
    private uaInfo: UAInfo,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private platform: Platform,
    private zone: NgZone
  ) { }

  private subscriptions: Subscription[] = [];
  private resumeSubscription?: Subscription;

  isLoading = false;
  error: string | null = null;
  isCameraReady: boolean = false;
  isOcrProcessingEnabled: boolean = false;
  isMirrorMode = true;
  isCardDetected = false;

  availableCropPresets: CropPreset[] = CropPresets;
  cropPreset: CropPreset = this.availableCropPresets[3];
  scaleFactor: number = 0.8;
  yoloResult: { type: string, score: number, width: number, height: number } = { type: '', score: 0, width: 0, height: 0 };
  ocrResult$ = new BehaviorSubject<ProcessedOcrFrame | null>(null);
  private destroy$ = new Subject<void>();
  processingTime: string = '';

  ngOnInit() {
    // this.setupResumeSubscription();
    this.platform.ready().then(() => {
      const capabilities = this.cameraManager.getCapabilities();
      if (!capabilities) {
        this.navCtrl.navigateRoot('/device-check');
        return;
      }

      this.initializeCamera();
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
      await this.handleCameraError('ngAfterViewInit', error.message);
    }
  }

  ngOnDestroy() {
    this.cleanup();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.resumeSubscription?.unsubscribe();
    // window.removeEventListener('orientationchange', this.handleOrientationChange.bind(this));
  }

  /**
  * Initialize camera with proper error handling and state management
  */
  public async initializeCamera(): Promise<void> {
    if (this.isLoading) {
      return;
    }

    try {
      this.isLoading = true;
      this.error = null;

      this.setupCameraEvents();
      await this.checkAndRequestPermissions();
      await this.setupInitialCamera();
    } catch (error) {
      this.handleCameraError('Camera Initialization Error', error as any);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Setup camera events
   */
  private setupCameraEvents() {
    // Event listener สำหรับทุก events
    // this.hasMultipleCameras = this.cameraManager.hasMultipleCameras();
    this.cameraManager.on('ALL', (response) => {
      if (response.status === 'error') {
        this.handleCameraError(response.error?.code, response.error?.message);
      }
    });

    // Event listener สำหรับเมื่อกล้องเริ่มทำงานสำเร็จ
    this.cameraManager.on('START_CAMERA_SUCCESS', () => {
      this.zone.run(async () => {
        this.isCameraReady = true;
        this.isLoading = false;
        await this.startProcessing();
        // this.currentCameraDevice = this.cameraManager.getCurrentCameraDevice();
        // this.currentResolution = this.cameraManager.getCurrentResolution() || { width: 0, height: 0, aspectRatio: 0, name: '' };
      });
    });

    // Event listener สำหรับเมื่อกล้องหยุดทำงาน
    this.cameraManager.on('STOP_CAMERA', () => {
      this.zone.run(() => {
        this.isCameraReady = false;
      });
    });
  }

  /**
   * Check and request camera permissions
   */
  private async checkAndRequestPermissions(): Promise<void> {
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
    } catch (error) {
      await this.handleCameraError('Camera Permissions Error', error as any);
    }
  }

  /**
  * Setup initial camera configuration
  */
  private async setupInitialCamera(): Promise<void> {
    const cameraDeviceSelector = new CameraDeviceSelector();
    const allDevices = await this.cameraManager.getCameraDevices();
    const selectedCamera = await cameraDeviceSelector.selectCamera(allDevices, FacingMode.Front);
    if (!selectedCamera) {
      throw new Error('No camera device found');
    }

    // ตั้งค่าการใช้งานกล้อง
    await this.waitForElements();

    // ตั้งค่าการใช้งานกล้อง
    this.cameraManager.setCurrentCameraConfiguration({
      videoElement: this.videoElement.nativeElement,
      canvasElement: this.canvasElement.nativeElement,
      enableAudio: false,
      resolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.FHD],
      fallbackResolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.HD],
      autoSwapResolution: this.uaInfo.isMobile() || this.uaInfo.isTablet(),
      // mirror: this.currentFacingMode === FacingMode.Front,
    });

    // เริ่มกล้องด้วยความละเอียดที่แนะนำ
    await this.cameraManager.startCameraWithResolution(true);
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

  private stopCamera() {
    this.cameraManager.stopCamera();
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
    }
  }

  private async cleanup() {
    await this.cameraManager.stopCamera();
    this.cameraManager.destroy();
    this.isCameraReady = false;
    this.error = null;
  }

  private async startProcessing(): Promise<void> {
    await this.showToast('กําลังทำการตรวจจับบัตร...');
    this.isOcrProcessingEnabled = true;
    // this.isAnimationBorderEnabled = true;
    // this.remainingTime = this.timeCounter;

    setTimeout(async () => {
      console.log('Initiating frame processing and timer...');
      this.processFrames();
      // this.startTimer();
    }, 300);
  }

  private async stopProcessing(): Promise<void> {
    await this.showToast('การตรวจจับบัตรถูกยกเลิก');
    this.isOcrProcessingEnabled = false;
    // this.isAnimationBorderEnabled = false;
    // this.stopTimer();
    // this.removeResizeObserver();
    this.ocrService.destroyOcrClient();
    // this.resizeObserver?.disconnect();
  }

  async processFrames() {
    if (!this.isOcrProcessingEnabled || !this.cameraManager.getCurrentStream()) return;

    console.log('processing frame...');

    try {
      // TODO: ส่งภาพจากกล้องไปที่ API เพื่อตรวจจับบัตร
      // สมมติว่าเรียก API แล้วได้ผลลัพธ์กลับมา
      const { capturedImage, bitmap } = await this.takeSnapshot();
      if (!capturedImage || !capturedImage.uri || !bitmap) {
        throw new Error('Failed to capture frame');
      }

      console.log('captured image:', capturedImage);
      console.log('bitmap:', bitmap);

      // Process frame with OCR
      const startTime = performance.now();
      const prediction = await this.processedFrame(capturedImage.uri, bitmap, startTime);
      this.isCardDetected = prediction.processingTimeMs < 185;

      // Update ui
      this.updateStateWithNewFrameData(prediction);

      console.log('prediction:', prediction);

      // Check if next frame should be processed
      if (prediction.isValid && prediction.state === ProcessingState.PASSED) {
        // await this.capturePhoto();
        return;
      }

      if (this.isOcrProcessingEnabled) {
        await Promise.resolve().then(() => this.processFrames());
      }
    } catch (error) {
      console.error('Failed to process frame', error);
    }
  }

  private async processedFrame(
    imageBase64: string,
    bitmap: ImageBitmap,
    startTime: number,
  ): Promise<ProcessedOcrFrame> {
    if (this.ocrService.getOcrClient() === null) {
      await this.setupOcrClient();
      return this.createFailedProcessedFrame(imageBase64, startTime);
    }

    if (!this.isOcrProcessingEnabled) {
      return this.createFailedProcessedFrame(imageBase64, startTime);
    }

    const hocr = await this.ocrService.getHOCR(bitmap);
    const result = this.cardRegExpService.parseHOCR(hocr, 'national');
    return this.processedThaiIdCardFromOcrResult(result, imageBase64, startTime);
  }

  private async processedThaiIdCardFromOcrResult(
    ocrResult: HOCRResult,
    base64: string,
    startTime: number,
  ): Promise<ProcessedOcrFrame> {
    const { extractedText, nationalIdInfo } = ocrResult;
    const { boundingBox } = nationalIdInfo;

    const idNumber = this.cardRegExpService.extractThaiIdNumber(extractedText);
    const isValidIdNumber = this.cardRegExpService.isValidThaiIdNumber(idNumber);
    const detectedWords = this.cardRegExpService.findThaiWords(extractedText);


    // convert base64 to image
    const img = cv.imread(this.canvasElement.nativeElement);
    this.yoloResult = await this.yoloService.processYolo(img);
    console.log('yolo result:', this.yoloResult);

    const finalState = this.getFinalState(
      extractedText,
      isValidIdNumber,
      detectedWords.length >= 1,
      this.isValidCardSize(),
    );

    return {
      state: finalState,
      base64Image: base64,
      processingTimeMs: this.calculateProcessingTime(startTime),
      extractedText,
      isValid: isValidIdNumber,
      ocrData: {
        idNumber,
        detectedWords,
        idNumberBoundingBox: boundingBox,
      },
    };
  }

  private createFailedProcessedFrame(base64: string, startTime: number): ProcessedOcrFrame {
    return {
      state: ProcessingState.FAILED,
      base64Image: base64,
      processingTimeMs: this.calculateProcessingTime(startTime),
    };
  }

  private isValidCardSize() {
    const data = this.yoloResult;
    return (data.width >= 700 && data.width <= 1200) && (data.height >= 350 && data.height <= 600);
  }

  private getFinalState(
    extractedText: string,
    isValidIdNumber: boolean,
    hasEnoughWords: boolean,
    isValidSize: boolean,
  ): ProcessingState {
    if (!extractedText) {
      return ProcessingState.TEXT_NOT_FOUND;
    }

    if (extractedText.length <= 20) {
      return ProcessingState.TEXT_NOT_ENOUGH;
    }

    if (!isValidIdNumber) {
      return ProcessingState.INVALID_FORMAT;
    }

    if (!isValidSize) {
      return ProcessingState.INVALID_SIZE;
    }

    return hasEnoughWords ? ProcessingState.PASSED : ProcessingState.WORD_NOT_ENOUGH;
  }

  private updateStateWithNewFrameData(newFrameData: ProcessedOcrFrame): void {
    const { state, isValid, ocrData } = newFrameData;
    const { cardDimensions } = ocrData || {};

    this.processingTime = newFrameData.processingTimeMs.toFixed(2);
    console.log('processing time:', this.processingTime);
    if (isValid && cardDimensions?.isValid) {
      this.ocrResult$.next(newFrameData);
    }

    // const scanStatePercentage = this.remainingTime > 0 ? this.getScanStatePercentage(state) : 0;
    // this.updateScanState(scanStatePercentage);
  }


  /**
    * Take Snapshot
    */
  public async takeSnapshot(): Promise<{ capturedImage: CapturedImage | null; bitmap: ImageBitmap | null }> {
    let capturedImage: CapturedImage | null = null;
    let bitmap: ImageBitmap | null = null;

    try {
      capturedImage = await this.cameraManager.captureImage({
        base64: true,
        format: ImageFormat.JPEG,
        quality: 0.92,
        scale: 1,
        mirror: this.isMirrorMode,
      });

      if (capturedImage && capturedImage.uri) {
        const croppedImage = await this.imageProcessingService.cropImage(capturedImage.uri, this.cropPreset.dimensions);
        bitmap = await this.imageProcessingService.base64ToImageBitmap(croppedImage);
      } else {
        console.warn('No captured image found or base64 data is missing.');
      }
    } catch (error: any) {
      console.error('Capture Error:', error);
      this.handleCameraError('Capture Error', error.message);
    }

    return { capturedImage, bitmap };
  }

  public async capturePhoto() {
    this.isOcrProcessingEnabled = false;
    // this.isAnimationBorderEnabled = true;
    // this.stopTimer();

    const lastValidFrameData = this.ocrResult$.getValue();
    if (!lastValidFrameData || !lastValidFrameData.base64Image) {
      console.error('No valid frame data found');
      return;
    }

    // Show success animation
    // await this.showSuccessAnimation();
    this.cameraManager.stopCamera();
    this.stopProcessing();
  }

  async switchCamera() {
    if (!this.cameraManager || this.isLoading) return;

    this.isLoading = true;
    try {
      await this.cameraManager.switchCamera();
    } catch (err) {
      this.handleCameraError('SWITCH_CAMERA_ERROR', 'Failed to switch camera');
    } finally {
      this.isLoading = false;
    }
  }

  retakePhoto() {
    this.ocrResult$.next(null);
    this.reinitializeCamera();
  }

  private async reinitializeCamera() {
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

  async confirmAndProceed() {
    const result = this.ocrResult$.value;
    if (!result) return;

    const alert = await this.alertCtrl.create({
      header: 'ยืนยันข้อมูล',
      message: 'คุณต้องการยืนยันข้อมูลที่สแกนได้หรือไม่?',
      buttons: [
        {
          text: 'ยกเลิก',
          role: 'cancel'
        },
        {
          text: 'ยืนยัน',
          handler: () => {
            // TODO: Handle confirmation
            console.log('Confirmed OCR result:', result);
          }
        }
      ]
    });
    await alert.present();
  }

  // =============== Private Methods ===============

  private async handleCameraError(code?: string, message?: string) {
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
    await this.showErrorToast(errorMessage);
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

  private calculateProcessingTime(startTimestamp: number): number {
    const endTime = performance.now();
    const processingTime = endTime - startTimestamp;
    return processingTime;
  }

  private async setupOcrClient(): Promise<void> {
    try {
      await this.ocrService.initializeOcrClient(THA_FAST_MODEL);
      await this.yoloService.loadModel();
    } catch (error: any) {
      this.handleCameraError('Error initializing OCR client', error.message);
    }
  }

}