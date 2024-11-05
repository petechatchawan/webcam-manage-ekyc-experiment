
import { FacingMode } from './camera.manager';
import { UAInfo } from './ua-info';
const IOS_CAMERA_PATTERNS = {
  FRONT_CAMERA: /^(front camera|กล้องด้านหน้า)$/i,
  FRONT_ULTRA_WIDE: /^(front ultra wide camera|กล้องด้านหน้าอัลตร้าไวด์)$/i,
  BACK_TRIPLE: /^(back triple camera|กล้องสามตัวด้านหลัง)$/i,
  BACK_DUAL: /^(back dual camera|กล้องคู่ด้านหลัง)$/i,
  BACK_CAMERA: /^(back Camera|กล้องด้านหลัง)$/i,
};

export interface CameraDevice {
  label: string;
  deviceId: string;
  index: number;
  facingMode: FacingMode;
}

export class CameraDeviceSelector {
  private uaInfo = new UAInfo();
  private uaParser: UAInfo;
  private availableCameraDevices: CameraDevice[] = [];

  constructor() {
    const userAgent = navigator.userAgent;
    this.uaParser = this.uaInfo.setUserAgent(userAgent);
  }

  /**
   * Selects a camera device based on preferred facing mode and device capabilities.
   */
  public async selectCamera(
    videoDevices: MediaDeviceInfo[],
    preferredFacingMode: FacingMode
  ): Promise<MediaDeviceInfo | null> {
    this.availableCameraDevices = await Promise.all(
      videoDevices.map(async (device, index) => {
        let facingMode: FacingMode = FacingMode.Front;
        try {
          const capabilities = (device as InputDeviceInfo).getCapabilities();
          if (capabilities.facingMode?.length) {
            facingMode = capabilities.facingMode[0] as FacingMode;
          }
        } catch (error) {
          console.warn('Failed to get device capabilities:', error);
        }

        const isMobile = this.uaParser.isMobile() || this.uaParser.isTablet();
        const isAndroid = this.uaParser.isOS('Android');
        const deviceIndex = isMobile && isAndroid ? this.parseAndroidDeviceIndex(device.label) : index;

        return {
          label: device.label || '',
          deviceId: device.deviceId,
          index: deviceIndex,
          facingMode,
        };
      })
    );

    const cameraDevice = this.uaParser.isDesktop()
      ? this.selectDesktopCamera()
      : this.selectMobileCamera(preferredFacingMode);

    return videoDevices.find(device => device.deviceId === cameraDevice?.deviceId) || null;
  }

  private parseAndroidDeviceIndex = (label: string): number => {
    const deviceParts = label.split(',').map(part => part.trim());
    const indexString = deviceParts[0].split(' ')[1];
    const index = Number.parseInt(indexString, 10);
    return index;
  };

  // Select desktop camera based on common desktop camera patterns
  private selectDesktopCamera(): CameraDevice {
    const pattern = /^(camera|กล้อง|facetime|integrated)$/i;
    const fallbackCamera = this.availableCameraDevices[0];
    const cameraCandidates = this.availableCameraDevices
      .filter(camera => pattern.test(camera.label.toLowerCase()))
      .sort((a, b) => a.index - b.index);
    return cameraCandidates.length > 0 ? cameraCandidates[0] : fallbackCamera;
  }

  // Select mobile camera based on the facing mode and OS type
  private selectMobileCamera(preferredFacingMode: FacingMode): CameraDevice | null {
    const matchingCameras = this.availableCameraDevices.filter(camera => camera.facingMode === preferredFacingMode);
    if (!matchingCameras.length) return null;
    return this.uaParser.isOS('iOS') || this.uaParser.isOS('MacOS')
      ? this.selectIosCamera(matchingCameras, preferredFacingMode)
      : this.selectAndroidCamera(matchingCameras);
  }

  // Select the best camera for iOS based on specific camera patterns (front/back)
  private selectIosCamera(cameras: CameraDevice[], facing: FacingMode): CameraDevice | null {
    const iosCameraPriority = this.getIOSCameraPriority();
    for (const regex of iosCameraPriority[facing]) {
      const matchedCamera = cameras.find(camera => regex.test(camera.label.toLowerCase()));
      if (matchedCamera) return matchedCamera;
    }

    // Fallback to the first available camera if no priority match
    return cameras[0] || null;
  }

  // Priority camera regex patterns for iOS (front and back)
  private getIOSCameraPriority(): Record<FacingMode, RegExp[]> {
    return {
      [FacingMode.Front]: [IOS_CAMERA_PATTERNS.FRONT_CAMERA, IOS_CAMERA_PATTERNS.FRONT_ULTRA_WIDE],
      [FacingMode.Back]: [
        IOS_CAMERA_PATTERNS.BACK_TRIPLE,
        IOS_CAMERA_PATTERNS.BACK_DUAL,
        IOS_CAMERA_PATTERNS.BACK_CAMERA,
      ],
    };
  }

  // Select the best camera for Android by sorting by index (or label if needed)
  private selectAndroidCamera(cameras: CameraDevice[]): CameraDevice {
    return cameras.reduce((prev, curr) => (prev.index < curr.index ? prev : curr));
  }
}

