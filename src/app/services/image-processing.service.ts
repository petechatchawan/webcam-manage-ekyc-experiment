import { Injectable } from '@angular/core';
import { CropPresetDimensions } from '../lib/types/crop.types';

const IMAGE_CONFIG = {
  quality: 0.9,
  mimeType: 'image/jpeg',
} as const;

@Injectable({
  providedIn: 'root',
})
export class ImageProcessingService {
  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to get canvas context');
    }
    return context;
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
  }

  async cropImage(imageDataUrl: string, cropDimensions: CropPresetDimensions): Promise<string> {
    const image = await this.loadImage(imageDataUrl);
    const { width, height } = image;

    const cropBox = {
      left: Math.floor(cropDimensions.left * width),
      top: Math.floor(cropDimensions.top * height),
      width: Math.min(width - Math.floor((cropDimensions.left + cropDimensions.right) * width), width),
      height: Math.min(height - Math.floor((cropDimensions.top + cropDimensions.bottom) * height), height),
    };

    const canvas = this.createCanvas(cropBox.width, cropBox.height);
    const context = this.getCanvasContext(canvas);

    context.drawImage(
      image,
      cropBox.left, cropBox.top,
      cropBox.width, cropBox.height,
      0, 0,
      cropBox.width, cropBox.height,
    );

    return canvas.toDataURL(IMAGE_CONFIG.mimeType);
  }

  public async base64ToImageBitmap(base64Image: string): Promise<ImageBitmap> {
    const base64Data = base64Image.split(',')[1] || base64Image;
    const blob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], {
      type: IMAGE_CONFIG.mimeType,
    });
    return createImageBitmap(blob);
  }

  public base64ToImageFile(base64Image: string): File | null {
    // Check if the base64Image is valid
    if (!base64Image || !base64Image.startsWith('data:image/')) {
      console.error('Invalid base64 image string');
      return null;
    }

    const matches = base64Image.match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/);
    if (!matches) {
      console.error('Base64 image format is not recognized');
      return null;
    }

    const imageType = matches[1];
    const base64Data = matches[2];
    const binaryData = atob(base64Data);
    const byteArray = new Uint8Array(binaryData.length);

    for (let i = 0; i < binaryData.length; i++) {
      byteArray[i] = binaryData.charCodeAt(i);
    }

    const blob = new Blob([byteArray], { type: `image/${imageType}` });
    const imageFile = new File([blob], `${Date.now()}.${imageType}`, { type: `image/${imageType}` });
    return imageFile;
  }
}
