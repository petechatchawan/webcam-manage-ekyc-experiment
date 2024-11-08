import { OCRBoundingBox } from "./ocr-parser.types";
import { ProcessingState } from "./processing.state.types";

export interface Dimensions {
  width: number;
  height: number;
}

// ผลลัพธ์การประมวลผลเฟรม
export interface ProcessedOcrFrame {
  state: ProcessingState;
  base64Image: string;
  processingTimeMs: number;
  extractedText?: string;
  isValid?: boolean;
  ocrData?: OcrExtractedData;
}

// ข้อมูลที่สกัดได้จาก OCR
export interface OcrExtractedData {
  idNumber?: string;
  detectedWords?: string[];
  idNumberBoundingBox?: OCRBoundingBox;
  cardDimensions?: IdSizeValidation;
}

// ฟังก์ชันการประมวลผล
export interface ThaiIdNumberExtraction {
  state: ProcessingState;
  idNumber: string;
  message: string;
}

export interface ThaiIdWordsDetection {
  state: ProcessingState;
  words: string[];
  message: string;
}

export interface ThaiIdValidation {
  state: ProcessingState;
  isValid: boolean;
  message: string;
}

export interface IdNumberBoundingBox {
  x1: number;
  y1: number;
  boundingBoxWidth: number;
  boundingBoxHeight: number;
}

export interface IdNumberBoxPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ขนาดของบัตรประชาชน
export enum IdCardSize {
  Small = 'small',
  Correct = 'correct',
  Large = 'large',
  Unknown = 'unknown',
}

// ผลลัพธ์การตรวจสอบ
export interface IdSizeValidation {
  isValid: boolean;
  message?: string;
  size?: IdCardSize;
  width?: number;
  height?: number;
  processingTime?: number;
}

// ขอบเขตที่ยอมรับได้สำหรับขนาดบัตร
export interface IdSizeLimitations {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}
