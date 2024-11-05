export interface Resolution {
    width: number;
    height: number;
    aspectRatio: number;
    name: string;
    preset?: VideoResolutionPreset; // optional เพื่อรองรับ custom resolution
}
export interface ResolutionOrientationSupport {
    landscape: boolean;
    portrait: boolean;
}

export interface SupportedResolutions {
    preset: VideoResolutionPreset;
    supported: boolean;
    supportedOrientations: ResolutionOrientationSupport;
    spec: Resolution;
    deviceId: string;
}

export enum VideoResolutionPreset {
    SD = 'SD',
    HD = 'HD',
    FHD = 'FHD',
    QHD = 'QHD',
    UHD = 'UHD',
    SQUARE_HD = 'SQUARE_HD',
    SQUARE_FHD = 'SQUARE_FHD'
}