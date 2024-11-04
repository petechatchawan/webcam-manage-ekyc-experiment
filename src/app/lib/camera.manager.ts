import { BehaviorSubject } from "rxjs";
import { UAInfo } from "./ua-info";
import { Resolution, STANDARD_RESOLUTIONS } from "./types/resolution.types";

// ================== Types & Interfaces ==================
export interface CameraConfig {
    videoElement?: HTMLVideoElement | null;
    canvasElement?: HTMLCanvasElement | null;
    enableAudio?: boolean;
    selectedDevice?: MediaDeviceInfo;
    facingMode?: FacingMode;
    resolution?: Resolution;
    fallbackResolution?: Resolution;
    mirror?: boolean;
    autoSwapResolution?: boolean;
}

export enum FacingMode {
    Front = 'user',
    Back = 'environment',
}

export enum VideoResolutionPreset {
    SD = 'SD',       // 480p
    HD = 'HD',       // 720p
    FHD = 'FHD',     // 1080p
    QHD = 'QHD',     // 1440p
    UHD = 'UHD',     // 2160p (4K)
    SQUARE_HD = 'SQUARE_HD', // 720x720
    SQUARE_FHD = 'SQUARE_FHD', // 1080x1080

}

export enum ImageFormat {
    JPEG = 'image/jpeg',
    PNG = 'image/png',
}

export interface CaptureOptions {
    quality: number;
    base64?: boolean;
    scale: number;
    format: ImageFormat;
    mirror?: boolean;
}

export interface CapturedImage {
    width: number;
    height: number;
    uri: string;
    base64?: string;
}

// ปรับปรุง interface เพื่อรองรับ deviceId ในผลลัพธ์
interface SupportedResolutions {
    preset: VideoResolutionPreset;
    supported: boolean;
    spec: Resolution;
    deviceId: string;
}

export enum CameraErrorCode {
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
    INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
    CAPTURE_ERROR = 'CAPTURE_ERROR',
    CONSTRAINT_ERROR = 'CONSTRAINT_ERROR',
    BROWSER_NOT_COMPATIBLE = 'BROWSER_NOT_COMPATIBLE',
    TRACK_NOT_FOUND = 'TRACK_NOT_FOUND',
    CONSTRAINT_FALLBACK_NOT_SATISFIED = 'CONSTRAINT_FALLBACK_NOT_SATISFIED',
    CONSTRAINT_NOT_SATISFIED = 'CONSTRAINT_NOT_SATISFIED',
    APPLY_CONSTRAINTS_ERROR = 'APPLY_CONSTRAINTS_ERROR',
    INVALID_STATE = 'INVALID_STATE',
    TAKE_PICTURE_FAILED = 'TAKE_PICTURE_FAILED',
    SWITCH_CAMERA_ERROR = 'SWITCH_CAMERA_ERROR',
    DEVICE_IN_USE = 'DEVICE_IN_USE',
    RESOLUTION_NOT_SUPPORTED = 'RESOLUTION_NOT_SUPPORTED',
    ORIENTATION_CHANGE_ERROR = 'ORIENTATION_CHANGE_ERROR',
    PERFORMANCE_ISSUE = 'PERFORMANCE_ISSUE',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export type CameraEvent = 'ALL' | 'START_CAMERA_SUCCESS' | 'STOP_CAMERA' | 'ERROR';

export interface CameraResponse<T = any> {
    status: 'success' | 'error';
    data?: T;
    error?: CameraError;
}

export interface CameraError {
    code: CameraErrorCode;
    message: string;
    originalError?: Error;
}

interface CameraMetrics {
    startupTime: number;
    frameRate: number;
    resolutionChanges: number;
    errors: CameraError[];
}

type EventHandler<T = any> = (response: CameraResponse<T>) => void;

// ================== Event System ==================
class CameraEvents {
    private eventListeners: { [event: string]: EventHandler[] } = {};

    on(event: CameraEvent, handler: EventHandler): void {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(handler);
    }

    emit<T>(event: CameraEvent, response: CameraResponse<T>): void {
        const listeners = this.eventListeners[event] || [];
        listeners.forEach(listener => listener(response));
    }

    off(event: CameraEvent, handler: EventHandler): void {
        if (!this.eventListeners[event]) return;
        this.eventListeners[event] = this.eventListeners[event].filter(h => h !== handler);
    }
}

// ================== Main Camera Manager Class ==================
export class CameraManager {
    private readonly events = new CameraEvents();
    private readonly uaInfo = new UAInfo();
    private readonly uaParser: UAInfo;
    private metrics: CameraMetrics = {
        startupTime: 0,
        frameRate: 0,
        resolutionChanges: 0,
        errors: []
    };

    private isGetUserMediaSupported: boolean = false;
    private isPermissionGranted: boolean = false;
    private availableDevices: MediaDeviceInfo[] = [];
    private deviceCapabilities: Map<string, MediaTrackCapabilities> = new Map();

    private isCameraInitializedFlag: boolean = false;
    private capturedImage: CapturedImage | null = null;
    private currentStream: MediaStream | null = null;
    private currentCameraDevice: MediaDeviceInfo | null = null;
    private currentResolution: Resolution | null = { width: 0, height: 0, aspectRatio: 0, name: '' };
    private currentCameraConfig: CameraConfig = {
        resolution: { width: 1280, height: 720, aspectRatio: 16 / 9, name: '720p' },
        enableAudio: false,
        mirror: true,
    };

    // private orientationHandler: (() => void) | null = null;

    constructor() {
        const userAgent = navigator.userAgent;
        this.uaParser = this.uaInfo.setUserAgent(userAgent);
        this.checkGetUserMediaSupport();
        // this.initOrientationHandler();
    }

    // ================== Public Methods ==================

    public on(event: CameraEvent, handler: EventHandler): void {
        this.events.on(event, handler);
    }

    public getMetrics(): CameraMetrics {
        return this.metrics;
    }

    /**
       * เริ่มกล้องด้วยการตั้งค่าปัจจุบัน
       */
    public async startCamera(): Promise<void> {
        this.isCameraInitializedFlag = false;
        const constraints = this.createConstraints();

        try {
            const stream = await this.initializeStream(constraints);
            this.saveActiveConfig(stream);
            this.applyMirrorEffect();
            await this.setVideoStream(stream);
        } catch (error) {
            throw error; // ส่งต่อ error ไปให้ startCameraWithResolution จัดการ
        } finally {
            this.isCameraInitializedFlag = true;
        }
    }

    public async stopCamera(): Promise<void> {
        if (!this.currentStream) return;
        this.currentStream.getTracks().forEach(track => track.stop());
        this.currentStream = null;
        if (this.currentCameraConfig.videoElement) {
            this.currentCameraConfig.videoElement.srcObject = null;
        }
        this.emitSuccess('STOP_CAMERA');
    }

    public async switchCamera(): Promise<void> {
        try {
            if (!this.currentCameraDevice || this.availableDevices.length <= 1) return;
            const currentDeviceId = this.currentCameraDevice?.deviceId;
            const currentIndex = this.availableDevices.findIndex(device => device.deviceId === currentDeviceId);
            const nextDevice = this.availableDevices[(currentIndex + 1) % this.availableDevices.length];
            await this.applyConfigChanges({ selectedDevice: nextDevice }, true);
        } catch (error: any) {
            this.emitError('ERROR', this.createError(
                CameraErrorCode.SWITCH_CAMERA_ERROR,
                'Failed to switch camera',
                error
            ));
        }
    }

    public toggleMirror(): void {
        this.currentCameraConfig.mirror = !this.currentCameraConfig.mirror;
        this.applyMirrorEffect();
    }

    public async captureImage(options: CaptureOptions): Promise<CapturedImage | null> {
        if (!this.currentStream || !this.currentCameraConfig.videoElement || !this.currentCameraConfig.canvasElement) {
            throw new Error('Camera is not started');
        }

        try {
            const videoElement = this.currentCameraConfig.videoElement;
            const canvasElement = this.currentCameraConfig.canvasElement;
            const { videoWidth, videoHeight } = videoElement;
            const { width, height } = this.calculateCaptureSize(videoWidth, videoHeight, options.scale);

            canvasElement.width = width;
            canvasElement.height = height;

            const context = canvasElement.getContext('2d');
            if (!context) {
                throw new Error('Unable to get canvas context');
            }

            if (options.mirror) {
                context.setTransform(-1, 0, 0, 1, width, 0);
            }

            context.drawImage(videoElement, 0, 0, width, height);
            const dataUrl = canvasElement.toDataURL(options.format, options.quality);
            this.setCapturedImage({
                width,
                height,
                uri: dataUrl,
                base64: dataUrl.split(',')[1],
            });

            return this.getCapturedImage();
        } catch (error: any) {
            this.emitError('ERROR', this.createError(
                CameraErrorCode.TAKE_PICTURE_FAILED,
                'Take picture failed',
                error
            ));

            return null;
        }
    }

    public async checkSupportedResolutions(deviceId?: string): Promise<SupportedResolutions[]> {
        try {
            const devices = await this.getCameraDevices();
            if (devices.length === 0) {
                throw new Error('No camera devices found');
            }

            const devicesToCheck = deviceId ?
                [{ deviceId }] :
                devices;

            const allResults: SupportedResolutions[] = [];
            for (const device of devicesToCheck) {
                try {
                    // เปิดกล้องครั้งเดียวด้วยความละเอียดสูงสุด
                    const stream = await this.getUserMedia({
                        video: {
                            deviceId: { exact: device.deviceId },
                            width: { ideal: 3840 }, // 4K width
                            height: { ideal: 2160 } // 4K height
                        }
                    });

                    // ตรวจสอบว่า stream ไม่เป็น null
                    if (!stream) {
                        throw new Error('Failed to get media stream');
                    }

                    const track = stream.getVideoTracks()[0];
                    const capabilities = track.getCapabilities();
                    const results: SupportedResolutions[] = [];

                    // ตรวจสอบว่ามี capabilities ที่จำเป็นครบถ้วน
                    if (!capabilities.width || !capabilities.height ||
                        typeof capabilities.width.min === 'undefined' ||
                        typeof capabilities.width.max === 'undefined' ||
                        typeof capabilities.height.min === 'undefined' ||
                        typeof capabilities.height.max === 'undefined') {
                        throw new Error('Device capabilities not available');
                    }

                    // ตรวจสอบทุกความละเอียดที่ต้องการ
                    for (const preset of Object.values(VideoResolutionPreset)) {
                        const spec = STANDARD_RESOLUTIONS[preset];

                        // เช็คว่าความละเอียดอยู่ในช่วงที่กล้องรองรับหรือไม่
                        const supported: boolean =
                            spec.width >= capabilities.width.min &&
                            spec.width <= capabilities.width.max &&
                            spec.height >= capabilities.height.min &&
                            spec.height <= capabilities.height.max;

                        results.push({
                            preset: preset,
                            supported: supported,
                            spec: spec,
                            deviceId: device.deviceId
                        });
                    }

                    // ปิดกล้องหลังจากตรวจสอบเสร็จ
                    track.stop();
                    allResults.push(...results);

                } catch (error) {
                    console.warn(`Failed to check device ${device.deviceId}:`, error);
                    // กรณี device ไม่สามารถตรวจสอบได้ ให้ mark ทุก resolution เป็น false
                    const fallbackResults = Object.values(VideoResolutionPreset).map(preset => ({
                        preset: preset,
                        supported: false,
                        spec: STANDARD_RESOLUTIONS[preset],
                        deviceId: device.deviceId
                    }));
                    allResults.push(...fallbackResults);
                }
            }

            // ถ้าระบุ deviceId มาให้ return เฉพาะผลของ device นั้น
            // ถ้าไม่ได้ระบุให้ return ผลของทุก device
            return deviceId ?
                allResults.filter(result => result.deviceId === deviceId) :
                allResults;

        } catch (error) {
            throw this.createError(
                CameraErrorCode.DEVICE_NOT_FOUND,
                'Failed to check supported resolutions',
                error
            );
        }
    }

    /**
   * เริ่มกล้องด้วยความละเอียดที่ระบุ
   */
    // ใน CameraManager class
    public async startCameraWithResolution(allowFallback: boolean = false): Promise<void> {
        try {
            console.log('startCameraWithResolution: Trying to start camera with specified configuration');
            try {
                await this.startCamera();
            } catch (error: any) {
                console.log('startCameraWithResolution: Error occurred while starting camera with specified configuration', error);
                if (error.name === 'OverconstrainedError' &&
                    allowFallback &&
                    this.currentCameraConfig.fallbackResolution
                ) {
                    // สร้าง deep copy ของ resolution ปัจจุบัน
                    const prevResolution: Resolution = {
                        width: this.currentCameraConfig.resolution?.width ?? 0,
                        height: this.currentCameraConfig.resolution?.height ?? 0,
                        aspectRatio: this.currentCameraConfig.resolution?.aspectRatio ?? 0,
                        name: this.currentCameraConfig.resolution?.name ?? ''
                    };

                    console.log('startCameraWithResolution: Trying to start camera with fallback resolution', this.currentCameraConfig.fallbackResolution);

                    // ตรวจสอบว่า fallbackResolution มีค่าครบ
                    if (this.isValidResolutionSpec(this.currentCameraConfig.fallbackResolution)) {
                        this.currentCameraConfig.resolution = this.currentCameraConfig.fallbackResolution;

                        try {
                            await this.startCamera();
                            console.log('startCameraWithResolution: Successfully started camera with fallback resolution');
                        } catch (fallbackError) {
                            console.log('startCameraWithResolution: Error occurred while starting camera with fallback resolution', fallbackError);
                            // คืนค่า resolution เดิมถ้า fallback ไม่สำเร็จ
                            this.currentCameraConfig.resolution = prevResolution;
                            throw fallbackError;
                        }
                    } else {
                        throw new Error('Invalid fallback resolution specification');
                    }
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.log('startCameraWithResolution: Error occurred during initialization', error);
            this.emitError('ERROR', this.createError(
                CameraErrorCode.INITIALIZATION_ERROR,
                'Failed to start camera with specified configuration',
                error
            ));
        }
    }

    // เพิ่ม type guard function
    private isValidResolutionSpec(spec: any): spec is Resolution {
        return typeof spec === 'object' &&
            typeof spec.width === 'number' &&
            typeof spec.height === 'number' &&
            typeof spec.aspectRatio === 'number' &&
            typeof spec.name === 'string';
    }

    public setResolution(resolution: Resolution | VideoResolutionPreset) {
        if (typeof resolution === 'string') {
            // ถ้าเป็น preset ให้ใช้จาก STANDARD_RESOLUTIONS
            this.currentCameraConfig.resolution = STANDARD_RESOLUTIONS[resolution];
        } else {
            // ถ้าเป็น custom resolution ใช้ค่าที่ส่งมาได้เลย
            this.currentCameraConfig.resolution = resolution;
        }
    }

    // ================== Private Methods ==================

    /**
     * ทำการ restart กล้อง - หยุดการทำงานและเริ่มใหม่ด้วยการตั้งค่าปัจจุบัน
     */
    public async restartCamera(): Promise<void> {
        if (!this.currentCameraConfig.videoElement) return;

        // บันทึกการตั้งค่าปัจจุบันก่อนหยุดกล้อง
        const currentTrack = this.currentStream?.getVideoTracks()[0];
        const previousSettings = currentTrack?.getSettings();
        const currentConfig = { ...this.currentCameraConfig };

        try {
            // หยุดกล้องก่อน
            await this.stopCamera();

            // บันทึก metrics
            this.metrics.resolutionChanges++;
            const startTime = performance.now();

            // เริ่มกล้องใหม่
            await this.startCamera();

            // ตรวจสอบการตั้งค่าใหม่
            const newTrack = this.currentStream?.getVideoTracks()[0];
            const newSettings = newTrack?.getSettings();

            // ตรวจสอบว่าการตั้งค่าใหม่ตรงกับการตั้งค่าเดิมหรือไม่
            if (previousSettings && newSettings) {
                const settingsMatch = this.compareTrackSettings(previousSettings, newSettings);
                if (!settingsMatch) {
                    console.warn('Camera settings changed after restart');
                    this.emitError('ERROR', this.createError(
                        CameraErrorCode.RESOLUTION_NOT_SUPPORTED,
                        'Failed to restore previous camera settings'
                    ));
                }
            }

            // อัพเดท metrics
            this.metrics.startupTime = performance.now() - startTime;

        } catch (error) {
            // ถ้าเกิดข้อผิดพลาด พยายามกู้คืนการตั้งค่าเดิม
            this.currentCameraConfig = currentConfig;

            throw this.createError(
                CameraErrorCode.INITIALIZATION_ERROR,
                'Failed to restart camera',
                error
            );
        }
    }

    /**
     * เปรียบเทียบการตั้งค่าของ track
     */
    private compareTrackSettings(
        settings1: MediaTrackSettings,
        settings2: MediaTrackSettings
    ): boolean {
        const relevantSettings = [
            'width',
            'height',
            'aspectRatio',
            'facingMode',
            'frameRate'
        ];

        return relevantSettings.every(setting =>
            settings1[setting as keyof MediaTrackSettings] ===
            settings2[setting as keyof MediaTrackSettings]
        );
    }

    /**
   * อัพเดทการตั้งค่ากล้องและนำไปใช้
   * @param newConfig การตั้งค่าใหม่ที่ต้องการ
   * @param forceRestart บังคับให้รีสตาร์ทกล้องหรือไม่
   */
    public async applyConfigChanges(newConfig: Partial<CameraConfig>, forceRestart: boolean = false): Promise<void> {
        try {
            const prevConfig = { ...this.currentCameraConfig };

            // ตรวจสอบการเปลี่ยนแปลงที่สำคัญ
            const isDeviceChanged = newConfig.selectedDevice?.deviceId !== this.currentCameraConfig.selectedDevice?.deviceId;
            const isFacingModeChanged = newConfig.facingMode !== this.currentCameraConfig.facingMode;
            const isResolutionChanged = newConfig.resolution && (
                newConfig.resolution.width !== this.currentCameraConfig.resolution?.width ||
                newConfig.resolution.height !== this.currentCameraConfig.resolution?.height
            );

            // อัพเดทการตั้งค่า
            this.currentCameraConfig = {
                ...this.currentCameraConfig,
                ...newConfig
            };

            // ถ้ายังไม่ได้เริ่มกล้องหรือไม่มี video element
            if (!this.currentStream || !this.currentCameraConfig.videoElement) {
                await this.startCamera();
                return;
            }

            // ถ้ามีการเปลี่ยนแปลงสำคัญหรือต้องการ force restart
            if (isDeviceChanged || isFacingModeChanged || isResolutionChanged || forceRestart) {
                await this.restartCamera();
                return;
            }

            // ถ้ามีการเปลี่ยนแปลงที่ไม่ต้อง restart
            const track = this.currentStream.getVideoTracks()[0];
            if (!track) {
                throw this.createError(
                    CameraErrorCode.TRACK_NOT_FOUND,
                    'No video track found in camera stream'
                );
            }

            // อัพเดท constraints ถ้าจำเป็น
            const currentSettings = track.getSettings();
            const newConstraints = this.createConstraints();
            const needsUpdate = this.hasSettingsChanged(currentSettings, newConstraints.video as MediaTrackConstraints);

            if (needsUpdate) {
                try {
                    await track.applyConstraints(newConstraints.video as MediaTrackConstraints);
                    // อัพเดท metrics
                    this.metrics.resolutionChanges++;
                } catch (error) {
                    // ถ้าไม่สามารถใช้การตั้งค่าใหม่ได้ ให้กลับไปใช้การตั้งค่าเดิม
                    this.currentCameraConfig = prevConfig;
                    throw error;
                }
            }

            // อัพเดทการตั้งค่าอื่นๆ ที่ไม่ต้องใช้ constraints
            if (this.currentCameraConfig.mirror !== prevConfig.mirror) {
                this.applyMirrorEffect();
            }

        } catch (error: any) {
            this.emitError('ERROR', this.createError(
                CameraErrorCode.APPLY_CONSTRAINTS_ERROR,
                'Failed to apply camera configuration changes',
                error
            ));
            throw error;
        }
    }

    /**
     * ตรวจสอบว่าการตั้งค่ามีการเปลี่ยนแปลงหรือไม่
     */
    private hasSettingsChanged(
        currentSettings: MediaTrackSettings,
        newConstraints: MediaTrackConstraints
    ): boolean {
        const significantChanges = [
            this.isConstraintChanged(currentSettings.width, newConstraints.width),
            this.isConstraintChanged(currentSettings.height, newConstraints.height),
            this.isConstraintChanged(currentSettings.facingMode, newConstraints.facingMode),
            this.isConstraintChanged(currentSettings.aspectRatio, newConstraints.aspectRatio)
        ];

        return significantChanges.some(changed => changed);
    }

    /**
     * เปรียบเทียบค่า constraint
     */
    private isConstraintChanged(
        currentValue: any,
        newConstraint: ConstrainULong | ConstrainDouble | ConstrainDOMString | undefined
    ): boolean {
        if (!newConstraint) return false;
        if (typeof newConstraint === 'object') {
            // ถ้าเป็น constraint object (ideal, exact, etc.)
            const constraintValue = (newConstraint as any).ideal || (newConstraint as any).exact;
            return currentValue !== constraintValue;
        }
        return currentValue !== newConstraint;
    }

    private async getDeviceCapabilities(deviceId: string): Promise<MediaTrackCapabilities> {
        if (this.deviceCapabilities.has(deviceId)) {
            return this.deviceCapabilities.get(deviceId)!;
        }

        try {
            const stream = await this.getUserMedia({
                video: { deviceId: { exact: deviceId } }
            });

            if (!stream) throw new Error('Failed to get stream for capabilities');

            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            this.deviceCapabilities.set(deviceId, capabilities);
            track.stop();
            return capabilities;
        } catch (error) {
            throw this.createError(
                CameraErrorCode.DEVICE_NOT_FOUND,
                'Failed to get device capabilities',
                error
            );
        }
    }

    private async initializeStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
        const startTime = performance.now();

        try {
            const stream = await this.getUserMedia(constraints);
            if (!stream) throw new Error('Failed to get stream');

            // Monitor frame rate
            if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
                let frameCount = 0;
                let lastCheck = performance.now();

                const frameCallback = () => {
                    frameCount++;
                    const now = performance.now();
                    if (now - lastCheck >= 1000) {
                        this.metrics.frameRate = frameCount;
                        frameCount = 0;
                        lastCheck = now;
                    }

                    if (this.isCameraStreaming()) {
                        this.currentCameraConfig.videoElement?.requestVideoFrameCallback(frameCallback);
                    }
                };

                this.currentCameraConfig.videoElement?.requestVideoFrameCallback(frameCallback);
            }

            this.metrics.startupTime = performance.now() - startTime;

            return stream;
        } catch (error: any) {
            if (error.name === 'NotReadableError') {
                throw this.createError(
                    CameraErrorCode.DEVICE_IN_USE,
                    'Camera is in use by another application',
                    error
                );
            }
            throw error;
        }
    }

    private createConstraints(): MediaStreamConstraints {
        const resolution = this.currentCameraConfig.resolution ?? { width: 1280, height: 720, aspectRatio: 16 / 9, name: '720p' };
        const autoSwapResolution = this.currentCameraConfig.autoSwapResolution ?? false;
        const { width, height } = this.getFinalResolution(resolution, autoSwapResolution);

        const videoConstraints: MediaTrackConstraints = {
            deviceId: this.currentCameraConfig.selectedDevice?.deviceId
                ? { exact: this.currentCameraConfig.selectedDevice.deviceId }
                : undefined,
            facingMode: this.currentCameraConfig.selectedDevice?.deviceId
                ? undefined
                : this.currentCameraConfig.facingMode,
            width: { exact: width },
            height: { exact: height },
            aspectRatio: { exact: width / height }
        };

        if (videoConstraints.facingMode === undefined) {
            delete videoConstraints.facingMode;
        }

        return {
            audio: this.currentCameraConfig.enableAudio,
            video: videoConstraints
        };
    }

    private getFinalResolution(resolution: Resolution, autoSwapResolution: boolean): Resolution {
        const isMobile = this.uaParser.isMobile() || this.uaParser.isTablet();
        if (autoSwapResolution && isMobile) {
            return {
                width: resolution.height,
                height: resolution.width,
                aspectRatio: resolution.aspectRatio,
                name: resolution.name
            };
        }
        return resolution;
    }

    private async waitForVideoLoad(): Promise<void> {
        return new Promise((resolve, reject) => {
            const video = this.currentCameraConfig.videoElement;
            if (!video) {
                return reject(new Error('Video element is null or undefined'));
            }

            video.addEventListener('loadedmetadata', () => {
                try {
                    video.play();
                    this.emitSuccess('START_CAMERA_SUCCESS', 'Camera started successfully');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            video.addEventListener('error', () => {
                reject(new Error('Failed to load video'));
            });
        });
    }

    private saveActiveConfig(stream: MediaStream): void {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        const { width = 0, height = 0, deviceId, aspectRatio, facingMode } = settings;

        // หาข้อมูลกล้องที่กำลังใช้งาน
        const selectedCamera = this.availableDevices.find(camera => camera.deviceId === deviceId);
        if (!selectedCamera) {
            console.warn('Selected camera not found in available devices');
        }

        // ตรวจสอบว่าได้ความละเอียดที่ต้องการหรือไม่
        const requestedResolution = this.currentCameraConfig.resolution;
        const autoSwapResolution = this.currentCameraConfig.autoSwapResolution;

        // ตรวจสอบว่าต้องสลับ width/height หรือไม่
        const shouldSwapDimensions = this.shouldSwapDimensions(
            requestedResolution,
            { width, height },
            autoSwapResolution ?? false
        );

        // สร้าง actualResolution โดยพิจารณาการสลับ width/height
        const actualResolution: Resolution = {
            width: shouldSwapDimensions ? height : width,
            height: shouldSwapDimensions ? width : height,
            aspectRatio: shouldSwapDimensions ?
                (height / width) :
                (aspectRatio || (width && height ? width / height : 0)),
            name: this.getResolutionName(
                shouldSwapDimensions ? height : width,
                shouldSwapDimensions ? width : height
            )
        };

        // ถ้าความละเอียดไม่ตรงกับที่ขอ ให้แจ้งเตือน
        if (requestedResolution &&
            (requestedResolution.width !== actualResolution.width ||
                requestedResolution.height !== actualResolution.height)) {
            console.warn(
                `Requested resolution (${requestedResolution.width}x${requestedResolution.height}) ` +
                `differs from actual resolution (${actualResolution.width}x${actualResolution.height})` +
                (shouldSwapDimensions ? ' (dimensions were swapped)' : '')
            );
        }

        // อัปเดตการตั้งค่าปัจจุบัน
        this.setCurrentStream(stream);
        this.setCurrentResolution(actualResolution);
        this.setCurrentCameraDevice(selectedCamera ?? null);

        // อัปเดต config ให้ตรงกับค่าจริง
        const updatedConfig: CameraConfig = {
            ...this.currentCameraConfig,
            resolution: actualResolution,
            selectedDevice: selectedCamera ?? undefined,
            facingMode: facingMode as FacingMode || this.currentCameraConfig.facingMode,
        };

        this.setCurrentCameraConfiguration(updatedConfig);
    }

    /**
 * ตรวจสอบว่าควรสลับ width และ height หรือไม่
 */
    private shouldSwapDimensions(
        requested: Resolution | undefined,
        actual: { width: number; height: number },
        autoSwapEnabled: boolean
    ): boolean {
        if (!requested || !autoSwapEnabled) {
            return false;
        }

        // กรณีที่ต้องสลับ:
        // 1. ถ้าขอ width: 1920, height: 1080 แต่ได้ width: 1080, height: 1920
        // 2. ถ้าขอ width: 1080, height: 1920 แต่ได้ width: 1920, height: 1080
        const currentAspectRatio = actual.width / actual.height;
        const requestedAspectRatio = requested.width / requested.height;

        // ถ้า aspect ratio ต่างกัน และการสลับจะทำให้ได้ resolution ที่ต้องการ
        if (Math.abs(currentAspectRatio - requestedAspectRatio) > 0.01) {
            const swappedWidth = actual.height;
            const swappedHeight = actual.width;

            return (
                swappedWidth === requested.width &&
                swappedHeight === requested.height
            ) || (
                    // หรือถ้าสลับแล้วใกล้เคียงกว่าไม่สลับ
                    Math.abs(swappedWidth / swappedHeight - requestedAspectRatio) <
                    Math.abs(currentAspectRatio - requestedAspectRatio)
                );
        }

        return false;
    }

    // Helper method สำหรับระบุชื่อความละเอียด
    private getResolutionName(width: number, height: number): string {
        // ตรวจสอบว่าตรงกับ preset ไหม
        const matchingPreset = Object.values(STANDARD_RESOLUTIONS).find(
            spec => spec.width === width && spec.height === height
        );

        if (matchingPreset) {
            return matchingPreset.name;
        }

        // ถ้าเป็น square
        if (width === height) {
            return `Square ${width}p`;
        }

        // สร้างชื่อตามขนาด
        if (width >= 3840) return '4K';
        if (width >= 2560) return 'QHD';
        if (width >= 1920) return 'FHD';
        if (width >= 1280) return 'HD';
        return `${width}x${height}`;
    }


    private applyMirrorEffect(): void {
        if (this.currentCameraConfig.videoElement) {
            this.currentCameraConfig.videoElement.style.transform = this.currentCameraConfig.mirror
                ? 'scaleX(-1)'
                : 'scaleX(1)';
        }
    }

    private async setVideoStream(stream: MediaStream): Promise<void> {
        if (this.currentCameraConfig.videoElement && stream) {
            this.currentCameraConfig.videoElement.srcObject = stream;
            await this.waitForVideoLoad();
        }
    }

    private calculateCaptureSize(videoWidth: number, videoHeight: number, scale: number): { width: number; height: number } {
        const width = videoWidth * scale;
        const height = (videoHeight * width) / videoWidth;
        return { width, height };
    }

    private checkGetUserMediaSupport(): void {
        this.isGetUserMediaSupported =
            typeof navigator.mediaDevices === 'object' &&
            typeof navigator.mediaDevices.getUserMedia === 'function' &&
            typeof window.MediaStream === 'function';

        if (!this.isGetUserMediaSupported) {
            throw this.createError(CameraErrorCode.DEVICE_NOT_FOUND, 'No camera devices found');
        }
    }

    private emitSuccess<T>(event: CameraEvent, data?: T): void {
        this.events.emit(event, { status: 'success', data });
    }

    private emitError(event: CameraEvent, error: CameraError): void {
        this.events.emit(event, { status: 'error', error });
    }

    private createError(code: CameraErrorCode, message: string, originalError?: any): CameraError {
        return {
            code,
            message,
            originalError: originalError instanceof Error ? originalError : undefined
        };
    }

    // ================== Utility Methods ==================

    public getAvailableCameraDevices(): MediaDeviceInfo[] {
        return this.availableDevices;
    }

    public getCurrentCameraDevice(): MediaDeviceInfo | null {
        return this.currentCameraDevice;
    }

    public getCurrentResolution(): Resolution | null {
        return this.currentResolution;
    }

    public getCurrentStream(): MediaStream | null {
        return this.currentStream;
    }

    public getCurrentToggleMirror(): boolean | undefined {
        return this.currentCameraConfig.mirror;
    }

    public hasMultipleCameras(): boolean {
        return this.availableDevices.length > 1;
    }

    public setCurrentStream(stream: MediaStream | null): void {
        this.currentStream = stream;
    }

    public setCurrentCameraConfiguration(config: CameraConfig): void {
        this.currentCameraConfig = config;
    }

    public setCurrentCameraDevice(camera: MediaDeviceInfo | null): void {
        this.currentCameraDevice = camera;
    }

    public setCurrentResolution(resolution: Resolution | null): void {
        this.currentResolution = resolution;
    }

    public setCapturedImage(image: CapturedImage): void {
        this.capturedImage = image;
    }

    public getCapturedImage(): CapturedImage | null {
        return this.capturedImage;
    }

    public getCurrentCameraConfig(): CameraConfig {
        return this.currentCameraConfig;
    }

    public isCameraStreaming(): boolean {
        return !!this.currentStream;
    }

    public isCameraInitialized(): boolean {
        return this.isCameraInitializedFlag;
    }

    public isCameraAccessSupported(): boolean {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    public async hasPermissions(): Promise<boolean> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasCameraPermission = devices.some(({ kind, label }) => kind === 'videoinput' && label !== '');
            this.isPermissionGranted = hasCameraPermission;
            return hasCameraPermission;
        } catch {
            this.isPermissionGranted = false;
            return false;
        }
    }

    public async requestPermission(): Promise<boolean> {
        if (this.isPermissionGranted) {
            return true;
        }

        let permissionStream: MediaStream | null = null;
        try {
            permissionStream = await this.getUserMedia({ video: true });
            this.isPermissionGranted = !!permissionStream;
            return this.isPermissionGranted;
        } catch (error: any) {
            this.isPermissionGranted = false;
            this.emitError('ERROR', this.createError(
                CameraErrorCode.BROWSER_NOT_COMPATIBLE,
                'Browser not compatible',
                error
            ));
            return false;
        } finally {
            if (permissionStream) {
                permissionStream.getTracks().forEach(track => track.stop());
            }
        }
    }

    public async getCameraDevices(): Promise<MediaDeviceInfo[]> {
        if (this.availableDevices.length > 0) {
            return this.availableDevices;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            this.availableDevices = videoDevices;
            return this.availableDevices;
        } catch (error: any) {
            this.emitError('ERROR', this.createError(
                CameraErrorCode.DEVICE_NOT_FOUND,
                'Device not found',
                error
            ));
            return [];
        }
    }

    public async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream | null> {
        try {
            if (this.isCameraStreaming()) {
                this.stopCamera();
            }

            if (this.isGetUserMediaSupported) {
                return await navigator.mediaDevices.getUserMedia(constraints);
            }

            const _getUserMedia =
                (navigator as any)['mozGetUserMedia'] ||
                (navigator as any)['webkitGetUserMedia'] ||
                (navigator as any)['msGetUserMedia'];
            return new Promise((resolve, reject) => _getUserMedia.call(navigator, constraints, resolve, reject));
        } catch (error) {
            throw error;
        }
    }

    public destroy(): void {
        this.stopCamera();
        this.deviceCapabilities.clear();
        this.metrics = {
            startupTime: 0,
            frameRate: 0,
            resolutionChanges: 0,
            errors: []
        };
    }


    // ================== Check Resolution Availability Methods ==================
    private capabilitySubject = new BehaviorSubject<CameraCapability | null>(null);
    public capability$ = this.capabilitySubject.asObservable();

    public getCapabilities(): CameraCapability | null {
        return this.capabilitySubject.getValue();
    }


    public async checkCameraCapabilities(): Promise<boolean> {
        try {
            if (!this.isCameraAccessSupported()) {
                throw new Error('Camera API not supported');
            }

            const hasPermission = await this.hasPermissions();
            if (!hasPermission) {
                throw new Error('Camera permission denied');
            }

            const devices = await this.getCameraDevices();
            if (devices.length === 0) {
                throw new Error('No camera devices found');
            }

            const defaultDevice = devices[0];
            const supportedResolutions = await this.checkSupportedResolutions(defaultDevice.deviceId);
            const availableResolutions = supportedResolutions
                .filter(res => res.supported)
                .map(res => res.preset);

            if (availableResolutions.length === 0) {
                throw new Error('No supported resolutions found');
            }

            const recommendedResolution = availableResolutions.includes(VideoResolutionPreset.HD)
                ? VideoResolutionPreset.HD
                : availableResolutions[0];

            const capabilities: CameraCapability = {
                isSupported: true,
                hasMultipleCameras: devices.length > 1,
                availableDevices: devices,
                supportedResolutions: availableResolutions,
                defaultDevice: defaultDevice,
                recommendedResolution: recommendedResolution
            };

            this.capabilitySubject.next(capabilities);
            return true;

        } catch (error: any) {
            const failedCapability: CameraCapability = {
                isSupported: false,
                hasMultipleCameras: false,
                availableDevices: [],
                supportedResolutions: [],
                errorMessage: error.message
            };

            this.capabilitySubject.next(failedCapability);
            return false;
        }
    }
}

export interface CameraCapability {
    isSupported: boolean;
    hasMultipleCameras: boolean;
    availableDevices: MediaDeviceInfo[];
    supportedResolutions: VideoResolutionPreset[];
    defaultDevice?: MediaDeviceInfo;
    recommendedResolution?: VideoResolutionPreset;
    errorMessage?: string;
}