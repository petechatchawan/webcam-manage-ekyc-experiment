import { Resolution, VideoResolutionPreset } from "../types/resolution.types";

export const STANDARD_RESOLUTIONS: { [key in VideoResolutionPreset]: Resolution } = {
    [VideoResolutionPreset.SD]: {
        width: 640,
        height: 480,
        aspectRatio: 4 / 3,
        name: 'SD',
        preset: VideoResolutionPreset.SD
    },
    [VideoResolutionPreset.HD]: {
        width: 1280,
        height: 720,
        aspectRatio: 16 / 9,
        name: 'HD',
        preset: VideoResolutionPreset.HD
    },
    [VideoResolutionPreset.FHD]: {
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        name: 'FHD',
        preset: VideoResolutionPreset.FHD
    },
    [VideoResolutionPreset.QHD]: {
        width: 2560,
        height: 1440,
        aspectRatio: 16 / 9,
        name: 'QHD',
        preset: VideoResolutionPreset.QHD
    },
    [VideoResolutionPreset.UHD]: {
        width: 3840,
        height: 2160,
        aspectRatio: 16 / 9,
        name: 'UHD',
        preset: VideoResolutionPreset.UHD
    },
    [VideoResolutionPreset.SQUARE_HD]: {
        width: 720,
        height: 720,
        aspectRatio: 1,
        name: 'Square HD',
        preset: VideoResolutionPreset.SQUARE_HD
    },
    [VideoResolutionPreset.SQUARE_FHD]: {
        width: 1080,
        height: 1080,
        aspectRatio: 1,
        name: 'Square FHD',
        preset: VideoResolutionPreset.SQUARE_FHD
    }
};