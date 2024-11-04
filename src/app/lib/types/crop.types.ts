export interface CropPreset {
    name: string;
    dimensions: CropPresetDimensions;
}

export interface CropPresetDimensions {
    top: number;
    left: number;
    right: number;
    bottom: number;
}

export enum OcrCropQuality {
    HIGH = 'High Quality',
    MEDIUM = 'Medium Quality',
    LOW = 'Low Quality',
    EXTRA_LOW = 'Extra Low Quality',
    BACK_ID_CARD = 'Back ID Card',
}