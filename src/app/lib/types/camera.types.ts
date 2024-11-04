import { CapturedImage } from "../camera.manager";
import { Resolution } from "./resolution.types";

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

export enum VideoResolution {
    SD = '480p',
    HD = '720p',
    FullHD = '1080p',
    UHD = '2160p',
}

export interface CameraState {
    isInitialized: boolean;
    isStreaming: boolean;
    currentDevice: MediaDeviceInfo | null;
    currentResolution: Resolution | null;
    currentStream: MediaStream | null;
    capturedImage: CapturedImage | null;
}