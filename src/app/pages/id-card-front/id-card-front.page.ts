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
    this.ocrResult$.complete();

    // Complete destroy$ subject
    this.destroy$.next();
    this.destroy$.complete();
  }


  // =================== Private ====================

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
      const isActive = await this.cameraManager.checkCameraActive();
      if (!isActive) {
        await this.cleanup();
        await this.initializeCamera();
      }
    }
  }

  private async cleanup() {
    await this.cameraManager.stopCamera();
    this.cameraManager.destroy();
    this.isCameraReady = false;
    this.error = null;
  }

  async initializeCamera() {
    if (this.isLoading) {
      console.log('Camera is already loading');
      return;
    }

    try {
      this.isLoading = true;
      this.error = null;
      // load and set state mirror mode
      this.isMirrorMode = localStorage.getItem('isMirrorMode') === 'true';

      const capabilities = this.cameraManager.getCapabilities();
      if (!capabilities || !capabilities.isSupported) {
        throw new Error('Camera not supported or not checked');
      }

      const cameraExtension = new CameraDeviceSelector();
      const allDevices = await this.cameraManager.getCameraDevices();
      const selectedCamera = await cameraExtension.selectCamera(allDevices, FacingMode.Back);
      if (!selectedCamera) {
        throw new Error('No camera device found');
      }

      console.log('[CameraManager] Selected camera:', selectedCamera);


      // รอสร้าง elements สำหรับการใช้งาน
      await this.waitForElements();

      // จัดการเกี่ยวกับ event ของกล้อง
      this.setupCameraEvents();

      // ตั้งค่า configuration
      this.cameraManager.setCurrentCameraConfiguration({
        videoElement: this.videoElement.nativeElement,
        canvasElement: this.canvasElement.nativeElement,
        enableAudio: false,
        selectedDevice: selectedCamera,
        resolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.FHD],
        fallbackResolution: STANDARD_RESOLUTIONS[VideoResolutionPreset.HD],
        autoSwapResolution: true,
        mirror: this.isMirrorMode,
      });

      // เริ่มกล้องด้วยความละเอียดที่แนะนำ
      await this.cameraManager.startCameraWithResolution(true);
    } catch (err: any) {
      this.handleCameraError('INITIALIZATION_ERROR', err.message);
    } finally {
      this.isLoading = false;
    }
  }

  private waitForElements = async (): Promise<void> => {
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

  private setupCameraEvents = () => {
    if (!this.cameraManager) return;

    // Event listener สำหรับทุก events
    this.cameraManager.on('ALL', (response) => {
      if (response.status === 'error') {
        this.handleCameraError(response.error?.code, response.error?.message);
      }
    });

    // Event listener สำหรับเมื่อกล้องเริ่มทำงานสำเร็จ
    this.cameraManager.on('START_CAMERA_SUCCESS', () => {
      this.zone.run(() => {
        this.toastCtrl.create({
          message: 'กล้องเริ่มทำงานแล้ว',
          duration: 2000
        });

        this.isCameraReady = true;
        this.isLoading = false;
        this.isOcrProcessingEnabled = true;

        // เริ่มการ predict ทุก 500ms
        this.startProcessing();
      });
    });

    // Event listener สำหรับเมื่อกล้องหยุดทำงาน
    this.cameraManager.on('STOP_CAMERA', () => {
      this.zone.run(() => {
        this.isCameraReady = false;
      });
    });
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

  private stopCamera() {
    if (this.cameraManager) {
      this.cameraManager.stopCamera();
    }
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
    }
  }

  retakePhoto() {
    this.ocrResult$.next(null);
    this.reinitializeCamera();
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