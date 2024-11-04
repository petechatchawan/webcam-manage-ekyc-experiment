import { Injectable } from "@angular/core";
import { Dimensions, IdSizeLimitations, IdSizeValidation, IdNumberBoundingBox, IdCardSize, BoundingBox } from "../interfaces/ocr";
import { CropPreset } from "../interfaces/crop-preset.interface";


@Injectable({
  providedIn: 'root',
})
export class ValidationIdCardService {
  // Constants for card size validation
  private readonly ACTUAL_ID_CARD_DIMENSIONS_MM: Dimensions = {
    width: 85.6,
    height: 53.98,
  }; // mm

  private readonly RESOLUTION_SCALE_FACTORS = {
    FHD: 1, // no scaling needed
    HD: 0.67, // scale down for HD resolution (720p is 2/3 of 1080p)
  };

  /**
   *
   *  National ID CARD
   *
   */
  private readonly NATIONAL_ID_WIDTH_MM = 30; // mm
  private readonly BASE_NATIONAL_ID_CARD_DIMENSIONS: Dimensions = {
    width: 1150,
    height: 730,
  };
  private readonly MAX_NATIONAL_ID_CARD_DIMENSIONS: Dimensions = {
    width: 1300,
    height: 800,
  };

  /**
   *
   *  Laser ID CARD
   *
   */
  private readonly LASER_ID_WIDTH_MM = 24; // mm
  private readonly BASE_LASER_ID_CARD_DIMENSIONS: Dimensions = {
    width: 1200,
    height: 750,
  };
  private readonly MAX_LASER_ID_CARD_DIMENSIONS: Dimensions = {
    width: 1500,
    height: 950,
  };

  private idCardType: 'national' | 'laser' = 'national';
  private resolutionType: 'FHD' | 'HD' = 'FHD'; // Default resolution
  public estimatedDimensions: Dimensions | null = null;
  public scaledDimensions: IdSizeLimitations | null = null;
  public cropPreset: CropPreset | null = null;
  public resizeThreshold: number = 0.65;

  constructor() { }

  public setIdCardConfig(
    type: 'national' | 'laser',
    resolution: 'FHD' | 'HD',
    cropPreset: CropPreset,
    threshold: number,
  ): void {
    this.idCardType = type;
    this.resolutionType = resolution;
    this.scaledDimensions = this.calculateSizeLimitationsForResolution();
    this.cropPreset = cropPreset;
    this.resizeThreshold = threshold;
  }

  /**
   * Calculate size limitations based on the selected resolution and ID card type.
   *
   * The size limitations are calculated by multiplying the base dimensions of the
   * ID card type with the scale factor of the selected resolution.
   *
   */
  private calculateSizeLimitationsForResolution(): IdSizeLimitations {
    const scaleFactor = this.RESOLUTION_SCALE_FACTORS[this.resolutionType];

    if (this.idCardType === 'national') {
      return {
        minWidth: Math.floor(this.BASE_NATIONAL_ID_CARD_DIMENSIONS.width * scaleFactor),
        minHeight: Math.floor(this.BASE_NATIONAL_ID_CARD_DIMENSIONS.height * scaleFactor),
        maxWidth: Math.floor(this.MAX_NATIONAL_ID_CARD_DIMENSIONS.width * scaleFactor),
        maxHeight: Math.floor(this.MAX_NATIONAL_ID_CARD_DIMENSIONS.height * scaleFactor),
      };
    } else {
      return {
        minWidth: Math.floor(this.BASE_LASER_ID_CARD_DIMENSIONS.width * scaleFactor),
        minHeight: Math.floor(this.BASE_LASER_ID_CARD_DIMENSIONS.height * scaleFactor),
        maxWidth: Math.floor(this.MAX_LASER_ID_CARD_DIMENSIONS.width * scaleFactor),
        maxHeight: Math.floor(this.MAX_LASER_ID_CARD_DIMENSIONS.height * scaleFactor),
      };
    }
  }

  /**
   * Validate ID card size from bounding box for the front side
   */
  public async validateFrontIdCardSize(
    boundingBox: BoundingBox,
    videoElement: HTMLVideoElement,
    processedCanvas: HTMLCanvasElement,
  ): Promise<IdSizeValidation> {
    return this.validateIdCardSize(boundingBox, videoElement, processedCanvas, this.NATIONAL_ID_WIDTH_MM);
  }

  /**
   * Validate ID card size from bounding box for the back side
   */
  public async validateBackIdCardSize(
    boundingBox: BoundingBox,
    videoElement: HTMLVideoElement,
    processedCanvas: HTMLCanvasElement,
  ): Promise<IdSizeValidation> {
    return this.validateIdCardSize(boundingBox, videoElement, processedCanvas, this.LASER_ID_WIDTH_MM);
  }

  private async validateIdCardSize(
    boundingBox: BoundingBox,
    videoElement: HTMLVideoElement,
    processedCanvas: HTMLCanvasElement,
    idCardWidth: number,
  ): Promise<IdSizeValidation> {
    if (!videoElement || !processedCanvas) {
      return this.createValidationResponse(false, 'videoElement or processedCanvas is null');
    }

    this.setCanvasDimensions(processedCanvas, videoElement);

    const idNumberBoundingBox = this.calculateBoundingBox(videoElement, processedCanvas, boundingBox);
    if (!idNumberBoundingBox) {
      return this.createValidationResponse(false, 'Failed to calculate ID number bounding box');
    }

    if (idNumberBoundingBox.boundingBoxWidth <= 0 || !this.scaledDimensions) {
      return this.createValidationResponse(false, 'All input dimensions must be positive numbers');
    }

    const idCardWidthRatio = idNumberBoundingBox.boundingBoxWidth / idCardWidth;
    const estimatedDimensions = this.getEstimatedDimensions(idCardWidthRatio);
    const dimensionValidation = this.validateDimensions(this.scaledDimensions, estimatedDimensions);

    return this.createValidationResponse(
      dimensionValidation.isValid,
      dimensionValidation.message || '',
      estimatedDimensions,
    );
  }

  private setCanvasDimensions(canvas: HTMLCanvasElement, videoElement: HTMLVideoElement): void {
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
  }

  private calculateBoundingBox(
    videoElement: HTMLVideoElement,
    processedCanvas: HTMLCanvasElement,
    boundingBox: BoundingBox,
  ): IdNumberBoundingBox | null {
    if (!this.cropPreset || this.resizeThreshold <= 0) {
      return null;
    }

    const { top: cropTop, left: cropLeft } = this.cropPreset.dimensions;
    const scalingFactor = this.resizeThreshold;
    const { x1, y1, x2, y2 } = boundingBox;

    if (videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
      return null;
    }

    const percentX1 = (x1 / (videoElement.videoWidth * scalingFactor) + cropLeft) * 100;
    const percentY1 = (y1 / (videoElement.videoHeight * scalingFactor) + cropTop) * 100;
    const percentX2 = (x2 / (videoElement.videoWidth * scalingFactor) + cropLeft) * 100;
    const percentY2 = (y2 / (videoElement.videoHeight * scalingFactor) + cropTop) * 100;
    if (percentX1 < 0 || percentY1 < 0 || percentX2 < 0 || percentY2 < 0) {
      return null;
    }

    const percentWidth = percentX2 - percentX1;
    const percentHeight = percentY2 - percentY1;
    if (percentWidth <= 0 || percentHeight <= 0) {
      return null;
    }

    return {
      x1: (percentX1 / 100) * processedCanvas.width,
      y1: (percentY1 / 100) * processedCanvas.height,
      boundingBoxWidth: (percentWidth / 100) * processedCanvas.width,
      boundingBoxHeight: (percentHeight / 100) * processedCanvas.height,
    };
  }

  private createValidationResponse(isValid: boolean, message: string, dimensions?: Dimensions): IdSizeValidation {
    return {
      isValid,
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0,
      size: dimensions ? this.determineSizeCategory(this.scaledDimensions!, dimensions) : IdCardSize.Unknown,
      message,
    };
  }

  private getEstimatedDimensions(widthRatio: number): Dimensions {
    return {
      width: this.ACTUAL_ID_CARD_DIMENSIONS_MM.width * widthRatio,
      height: this.ACTUAL_ID_CARD_DIMENSIONS_MM.height * widthRatio,
    };
  }

  private validateDimensions(sizeLimitations: IdSizeLimitations, estimatedDimensions: Dimensions): IdSizeValidation {
    const isWidthValid = this.isWithinRange(
      estimatedDimensions.width,
      sizeLimitations.minWidth,
      sizeLimitations.maxWidth,
    );

    const isHeightValid = this.isWithinRange(
      estimatedDimensions.height,
      sizeLimitations.minHeight,
      sizeLimitations.maxHeight,
    );

    const validationIssues = this.collectSizeValidationIssues(
      isWidthValid,
      isHeightValid,
      estimatedDimensions,
      sizeLimitations,
    );

    return {
      isValid: isWidthValid && isHeightValid,
      message: validationIssues.join(', '),
    };
  }

  private isWithinRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  private collectSizeValidationIssues(
    isWidthValid: boolean,
    isHeightValid: boolean,
    { width, height }: Dimensions,
    { minWidth, maxWidth, minHeight, maxHeight }: IdSizeLimitations,
  ): string[] {
    const issues: string[] = [];

    if (!isWidthValid) {
      issues.push(`Width invalid (${width.toFixed(2)} px, should be between ${minWidth}-${maxWidth} px)`);
    }
    if (!isHeightValid) {
      issues.push(`Height invalid (${height.toFixed(2)} px, should be between ${minHeight}-${maxHeight} px)`);
    }

    return issues;
  }

  private determineSizeCategory(sizeLimitations: IdSizeLimitations, dimensions: Dimensions): IdCardSize {
    if (dimensions.width < sizeLimitations.minWidth || dimensions.height < sizeLimitations.minHeight) {
      return IdCardSize.Small;
    }
    if (dimensions.width > sizeLimitations.maxWidth || dimensions.height > sizeLimitations.maxHeight) {
      return IdCardSize.Large;
    }
    return IdCardSize.Correct;
  }
}
