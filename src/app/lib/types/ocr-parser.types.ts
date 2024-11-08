export interface HOCRWord {
    id: string;
    text: string;
    boundingBox: number[];
    confidence: number;
    blockId: string;
    lineId: string;
}

export interface HOCRLine {
    lineId: string;
    text: string;
    words: HOCRWord[];
}

export interface OCRBoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface HOCRIdInfo {
    idNumber: string;
    lineId: string;
    boundingBox: OCRBoundingBox;
}

export interface HOCRResult {
    processingTimeMs: number;
    extractedText: string;
    lines: HOCRLine[];
    idInfo: HOCRIdInfo;
}