
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
  private availableCameraDevices: CameraDevice[] = [];

  constructor(
    private uaInfo = new UAInfo()
  ) {
    const userAgent = navigator.userAgent;
    this.uaInfo.setUserAgent(userAgent);
  }

  /**
   *
   * Select camera
   *
   * */
  // Main method to select camera based on device type
  public async selectCamera(
    videoDevices: MediaDeviceInfo[],
    preferredFacingMode: FacingMode
  ): Promise<MediaDeviceInfo | null> {
    // console.log('Selecting camera with preferred facing mode:', preferredFacingMode);
    this.availableCameraDevices = await Promise.all(
      videoDevices.map(async (device, index) => {
        console.log('Processing device:', device.label, 'at index:', index);
        let facingMode: FacingMode = FacingMode.Front;
        try {
          const capabilities = (device as InputDeviceInfo).getCapabilities();
          if (capabilities.facingMode && capabilities.facingMode.length > 0) {
            facingMode = capabilities.facingMode[0] as FacingMode;
          }
          console.log('Device capabilities obtained:', capabilities);
        } catch (error) {
          console.warn('Failed to get device capabilities:', error);
        }

        const isMobile = this.uaInfo.isMobile() || this.uaInfo.isTablet();
        const isAndroid = this.uaInfo.isOS('Android');
        const deviceIndex = isMobile && isAndroid ? this.parseAndroidDeviceIndex(device.label) : index;
        console.log('Assigned device index:', deviceIndex);

        return {
          ...device,
          label: device.label || '',
          deviceId: device.deviceId,
          index: deviceIndex,
          facingMode,
        };
      })
    );

    const cameraDevice = this.uaInfo.isDesktop()
      ? this.selectDesktopCamera()
      : this.selectMobileCamera(preferredFacingMode);
    console.log('Selected camera device:', cameraDevice?.deviceId);

    const finalCamera = videoDevices.find(device => device.deviceId === cameraDevice?.deviceId);
    console.log('Final camera device:', finalCamera?.deviceId);
    return finalCamera || null;
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
    console.log('[CameraDevicesSelector] Selecting camera for mobile with preferred facing mode:', preferredFacingMode);
    const matchingCameras = this.availableCameraDevices.filter(camera => camera.facingMode === preferredFacingMode);
    console.log('[CameraDevicesSelector] Matching cameras:', matchingCameras.map(camera => camera.deviceId));
    if (!matchingCameras.length) {
      console.log('[CameraDevicesSelector] No matching cameras found, returning null');
      return null;
    }
    console.log('[CameraDevicesSelector] Selecting camera from matching cameras...');
    return this.uaInfo.isOS('iOS') || this.uaInfo.isOS('MacOS')
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
    console.log('[CameraDevicesSelector] Selecting camera for Android...');
    console.log('[CameraDevicesSelector] Available cameras:', cameras.map(camera => camera.deviceId));
    const selectedCamera = cameras.reduce((prev, curr) => (prev.index < curr.index ? prev : curr));
    console.log('[CameraDevicesSelector] Selected camera for Android:', selectedCamera.deviceId);
    return selectedCamera;
  }
}
