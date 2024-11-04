export interface Resolution {
    width: number;
    height: number;
    aspectRatio: number;
    name: string;
    preset?: VideoResolutionPreset; // optional เพื่อรองรับ custom resolution
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