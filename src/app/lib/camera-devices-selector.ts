// import { FacingMode } from './camera.manager';
// import { UAInfo } from './ua-info';
// const IOS_CAMERA_PATTERNS = {
//   FRONT_CAMERA: /^(front camera|กล้องด้านหน้า)$/i,
//   FRONT_ULTRA_WIDE: /^(front ultra wide camera|กล้องด้านหน้าอัลตร้าไวด์)$/i,
//   BACK_TRIPLE: /^(back triple camera|กล้องสามตัวด้านหลัง)$/i,
//   BACK_DUAL: /^(back dual camera|กล้องคู่ด้านหลัง)$/i,
//   BACK_CAMERA: /^(back Camera|กล้องด้านหลัง)$/i,
// };

// export interface CameraDevice {
//   label: string;
//   deviceId: string;
//   index: number;
//   facingMode: FacingMode;
// }

// export class CameraExtension {
//   private uaInfo = new UAInfo();
//   private uaParser: UAInfo;
//   private availableCameraDevices: CameraDevice[] = [];

//   constructor() {
//     const userAgent = navigator.userAgent;
//     this.uaParser = this.uaInfo.setUserAgent(userAgent);
//   }

//   /**
//    *
//    * Select camera
//    *
//    * */
//   // Main method to select camera based on device type
//   public async selectCamera(
//     videoDevices: MediaDeviceInfo[],
//     preferredFacingMode: FacingMode
//   ): Promise<MediaDeviceInfo | null> {
//     this.availableCameraDevices = await Promise.all(
//       videoDevices.map(async (device, index) => {
//         let facingMode: FacingMode = FacingMode.Front;
//         try {
//           const capabilities = (device as InputDeviceInfo).getCapabilities();
//           if (capabilities.facingMode && capabilities.facingMode.length > 0) {
//             facingMode = capabilities.facingMode[0] as FacingMode;
//           }
//         } catch (error) {
//           console.warn('Failed to get device capabilities:', error);
//         }

//         const isMobile = this.uaParser.isMobile() || this.uaParser.isTablet();
//         const isAndroid = this.uaParser.isOS('Android');
//         const deviceIndex = isMobile && isAndroid ? this.parseAndroidDeviceIndex(device.label) : index;

//         return {
//           ...device,
//           label: device.label || '',
//           deviceId: device.deviceId,
//           index: deviceIndex,
//           facingMode,
//         };
//       })
//     );

//     const cameraDevice = this.uaParser.isDesktop()
//       ? this.selectDesktopCamera()
//       : this.selectMobileCamera(preferredFacingMode);
//     const finalCamera = videoDevices.find(device => device.deviceId === cameraDevice?.deviceId);
//     return finalCamera || null;
//   }

//   private parseAndroidDeviceIndex = (label: string): number => {
//     const deviceParts = label.split(',').map(part => part.trim());
//     const indexString = deviceParts[0].split(' ')[1];
//     const index = Number.parseInt(indexString, 10);
//     return index;
//   };

//   // Select desktop camera based on common desktop camera patterns
//   private selectDesktopCamera(): CameraDevice {
//     const pattern = /^(camera|กล้อง|facetime|integrated)$/i;
//     const fallbackCamera = this.availableCameraDevices[0];
//     const cameraCandidates = this.availableCameraDevices
//       .filter(camera => pattern.test(camera.label.toLowerCase()))
//       .sort((a, b) => a.index - b.index);
//     return cameraCandidates.length > 0 ? cameraCandidates[0] : fallbackCamera;
//   }

//   // Select mobile camera based on the facing mode and OS type
//   private selectMobileCamera(preferredFacingMode: FacingMode): CameraDevice | null {
//     const matchingCameras = this.availableCameraDevices.filter(camera => camera.facingMode === preferredFacingMode);
//     if (!matchingCameras.length) return null;
//     return this.uaParser.isOS('iOS') || this.uaParser.isOS('MacOS')
//       ? this.selectIosCamera(matchingCameras, preferredFacingMode)
//       : this.selectAndroidCamera(matchingCameras);
//   }

//   // Select the best camera for iOS based on specific camera patterns (front/back)
//   private selectIosCamera(cameras: CameraDevice[], facing: FacingMode): CameraDevice | null {
//     const iosCameraPriority = this.getIOSCameraPriority();
//     for (const regex of iosCameraPriority[facing]) {
//       const matchedCamera = cameras.find(camera => regex.test(camera.label.toLowerCase()));
//       if (matchedCamera) return matchedCamera;
//     }

//     // Fallback to the first available camera if no priority match
//     return cameras[0] || null;
//   }

//   // Priority camera regex patterns for iOS (front and back)
//   private getIOSCameraPriority(): Record<FacingMode, RegExp[]> {
//     return {
//       [FacingMode.Front]: [IOS_CAMERA_PATTERNS.FRONT_CAMERA, IOS_CAMERA_PATTERNS.FRONT_ULTRA_WIDE],
//       [FacingMode.Back]: [
//         IOS_CAMERA_PATTERNS.BACK_TRIPLE,
//         IOS_CAMERA_PATTERNS.BACK_DUAL,
//         IOS_CAMERA_PATTERNS.BACK_CAMERA,
//       ],
//     };
//   }

//   // Select the best camera for Android by sorting by index (or label if needed)
//   private selectAndroidCamera(cameras: CameraDevice[]): CameraDevice {
//     return cameras.reduce((prev, curr) => (prev.index < curr.index ? prev : curr));
//   }
// }


import { FacingMode } from "./types/camera.types";
import { UAInfo } from "./ua-info";

export const CAMERA_PATTERNS = {
  IOS: {
    FRONT: {
      PRIMARY: /^(front camera|กล้องด้านหน้า)$/i,
      ULTRA_WIDE: /^(front ultra wide camera|กล้องด้านหน้าอัลตร้าไวด์)$/i
    },
    BACK: {
      TRIPLE: /^(back triple camera|กล้องสามตัวด้านหลัง)$/i,
      DUAL: /^(back dual camera|กล้องคู่ด้านหลัง)$/i,
      PRIMARY: /^(back Camera|กล้องด้านหลัง)$/i
    }
  },
  DESKTOP: /^(camera|กล้อง|facetime|integrated)$/i
} as const;

// types.ts
export interface CameraDevice extends MediaDeviceInfo {
  index: number;
  facingMode: FacingMode;
}

export type CameraSelector = (devices: CameraDevice[]) => CameraDevice | null;

// camera-device-selector.ts
export class CameraDeviceSelector {
  private readonly deviceCache = new Map<string, CameraDevice>();
  private readonly uaParser: UAInfo;

  constructor(userAgent: string = navigator.userAgent) {
    this.uaParser = new UAInfo().setUserAgent(userAgent);
  }

  /**
   * Selects the most appropriate camera based on device type and preferences
   */
  public async selectOptimalCamera(
    devices: MediaDeviceInfo[],
    preferredFacing: FacingMode
  ): Promise<MediaDeviceInfo | null> {
    try {
      const enrichedDevices = await this.enrichDeviceInformation(devices);
      const selectedDevice = this.selectDeviceByPlatform(enrichedDevices, preferredFacing);

      return devices.find(device => device.deviceId === selectedDevice?.deviceId) || null;
    } catch (error) {
      console.error('Failed to select camera:', error);
      return devices[0] || null;
    }
  }

  /**
   * Enriches device information with additional properties
   */
  private async enrichDeviceInformation(devices: MediaDeviceInfo[]): Promise<CameraDevice[]> {
    const enrichmentPromises = devices.map(async (device, index) => {
      // Check cache first
      const cachedDevice = this.deviceCache.get(device.deviceId);
      if (cachedDevice) return cachedDevice;

      const enrichedDevice = await this.createEnrichedDevice(device, index);
      this.deviceCache.set(device.deviceId, enrichedDevice);

      return enrichedDevice;
    });

    return Promise.all(enrichmentPromises);
  }

  /**
   * Creates an enriched device object with additional information
   */
  private async createEnrichedDevice(
    device: MediaDeviceInfo,
    index: number
  ): Promise<CameraDevice> {
    let facingMode: FacingMode = FacingMode.Front;

    const capabilities = (device as InputDeviceInfo).getCapabilities();
    if (capabilities.facingMode && capabilities.facingMode.length > 0) {
      facingMode = capabilities.facingMode[0] as FacingMode;
    }

    const deviceIndex = this.shouldUseAndroidIndex(device.label)
      ? this.extractAndroidDeviceIndex(device.label)
      : index;

    return {
      ...device,
      index: deviceIndex,
      facingMode
    };
  }

  /**
     * Selects appropriate device selection strategy based on platform
     */
  private selectDeviceByPlatform(
    devices: CameraDevice[],
    preferredFacing: FacingMode
  ): CameraDevice | null {
    const selectors: Record<string, CameraSelector> = {
      desktop: this.selectDesktopDevice.bind(this),
      ios: (devs) => this.selectMobileDevice(devs, preferredFacing, this.selectIOSDevice.bind(this)),
      android: (devs) => this.selectMobileDevice(devs, preferredFacing, this.selectAndroidDevice.bind(this)),
      ['default']: (devs) => devs[0] || null  // แก้ไขตรงนี้
    };

    const platform = this.detectPlatform();
    const selector = selectors[platform] || selectors['default'];  // และตรงนี้

    return selector(devices);
  }

  /**
   * Detects current platform
   */
  private detectPlatform(): string {
    if (this.uaParser.isDesktop()) return 'desktop';
    if (this.uaParser.isOS('iOS')) return 'ios';
    if (this.uaParser.isOS('Android')) return 'android';
    return 'default';
  }

  /**
      * Selects appropriate desktop device
      */
  private selectDesktopDevice(devices: CameraDevice[]): CameraDevice | null {
    // เพิ่มการตรวจสอบ label ก่อนใช้ toLowerCase
    const filteredDevices = devices.filter(device => device.label && CAMERA_PATTERNS.DESKTOP.test(device.label.toLowerCase()));

    // ถ้าไม่เจอ device ที่ตรงกับ pattern ให้ใช้ตัวแรก
    return filteredDevices[0] || devices[0] || null;
  }

  /**
   * Generic mobile device selection with platform-specific refinement
   */
  private selectMobileDevice(
    devices: CameraDevice[],
    preferredFacing: FacingMode,
    platformSelector: CameraSelector
  ): CameraDevice | null {
    const matchingDevices = devices.filter(device => device.facingMode === preferredFacing);
    if (!matchingDevices.length) return null;
    return platformSelector(matchingDevices);
  }

  /**
   * Selects appropriate iOS device based on camera patterns
   */
  private selectIOSDevice(devices: CameraDevice[]): CameraDevice | null {
    const patterns = devices[0]?.facingMode === FacingMode.Front
      ? Object.values(CAMERA_PATTERNS.IOS.FRONT)
      : Object.values(CAMERA_PATTERNS.IOS.BACK);

    // เพิ่มการตรวจสอบ label
    for (const pattern of patterns) {
      const match = devices.find(device =>
        device.label && pattern.test(device.label.toLowerCase())
      );
      if (match) return match;
    }

    return devices[0] || null;
  }



  /**
   * Selects appropriate Android device based on index
   */
  private selectAndroidDevice(devices: CameraDevice[]): CameraDevice {
    return devices.reduce((prev, curr) =>
      prev.index < curr.index ? prev : curr
    );
  }

  /**
   * Determines if Android index extraction should be used
   */
  private shouldUseAndroidIndex(label: string): boolean {
    return (this.uaParser.isMobile() || this.uaParser.isTablet()) && this.uaParser.isOS('Android');
  }

  /**
    * Extracts device index from Android device label
    */
  private extractAndroidDeviceIndex(label: string): number {
    if (!label) return 0;
    const [firstPart] = label.split(',').map(part => part.trim());
    const [, indexStr] = firstPart.split(' ');
    return Number.parseInt(indexStr, 10) || 0;
  }
}