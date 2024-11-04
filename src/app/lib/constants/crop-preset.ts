import { CropPreset, OcrCropQuality } from "../types/crop.types";


export const CropPresets: CropPreset[] = [
  {
    name: OcrCropQuality.HIGH,
    dimensions: {
      top: 0.1,
      right: 0.15,
      bottom: 0.1,
      left: 0.15,
    },
  },
  {
    name: OcrCropQuality.MEDIUM,
    dimensions: {
      top: 0.1,
      right: 0.18,
      bottom: 0.22,
      left: 0.25,
    },
  },
  {
    name: OcrCropQuality.LOW,
    dimensions: {
      top: 0.1,
      right: 0.25,
      bottom: 0.32,
      left: 0.26,
    },
  },
  {
    name: OcrCropQuality.EXTRA_LOW,
    dimensions: {
      top: 0.1,
      right: 0.2,
      bottom: 0.65,
      left: 0.25,
    },
  },
  {
    name: OcrCropQuality.BACK_ID_CARD,
    dimensions: {
      top: 0.45,
      right: 0.25,
      bottom: 0.35,
      left: 0.25,
    },
  },
];
