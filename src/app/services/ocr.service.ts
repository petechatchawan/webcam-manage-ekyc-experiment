import { ElementRef, Injectable } from '@angular/core';
import { CardRegExpService } from 'src/app/services/card-reg-exp.service';
import { OCRClient } from 'tesseract-wasm';
import { THA_FAST_MODEL, workerURL } from '../lib/constants/tesseract';
import { HOCRLine, HOCRResult, HOCRWord } from '../lib/types/ocr-parser.types';
import { ProcessingState } from '../lib/types/processing.state.types';

export const VALIDATION_CONSTANTS = {
  MIN_DETECTED_WORDS: 1,
  ID_CARD_SIZE_TOLERANCE: 0.15,
  EXPECTED_DIMENSIONS: {
    WIDTH: 856,
    HEIGHT: 540
  }
} as const;

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  private ocrClient: OCRClient | null = null;
  private currentModel: string | null = null;

  private readonly BBOX_PATTERN = /bbox (\d+) (\d+) (\d+) (\d+)/;
  private readonly CONFIDENCE_PATTERN = /confidence (\d+\.?\d*)/;

  constructor(
    private cardRegExpService: CardRegExpService
  ) { }

  public getOcrClient(): OCRClient | null {
    return this.ocrClient;
  }

  public async initializeOcrClient(model: string = THA_FAST_MODEL): Promise<void> {
    try {
      this.ocrClient = new OCRClient({ workerURL });
      await this.loadModel(model);
    } catch (error) {
      console.error('Error initializing OCR client:', error);
    }
  }

  /**
   * Loads a specified OCR model into the OCR client.
   * If the client is already initialized with a different model, it will reload with the new model.
   */
  public async loadModel(model: string): Promise<void> {
    if (!this.ocrClient) {
      console.warn('OcrService: OCR client is not initialized');
      return;
    }

    await this.ocrClient.loadModel(model);
    this.currentModel = model;
  }

  /**
   * Processes the given bitmap image and returns the HOCR data.
   */
  public async getOCR(bitmap: ImageBitmap): Promise<string> {
    if (!this.ocrClient) {
      throw new Error('OCR client is not initialized');
    }

    // Load the image only if it's different
    await this.ocrClient.loadImage(bitmap);
    return this.ocrClient.getText();
  }

  /**
   * Processes the given bitmap image and returns the HOCR data.
   */
  public async getHOCR(bitmap: ImageBitmap): Promise<string> {
    if (!this.ocrClient) {
      throw new Error('OCR client is not initialized');
    }

    // Load the image only if it's different
    await this.ocrClient.loadImage(bitmap);
    return this.ocrClient.getHOCR();
  }

  /**
   * Destroys the OCR client and resets the state.
   */
  public destroyOcrClient(): void {
    if (this.ocrClient) {
      this.ocrClient.destroy();
      this.ocrClient = null;
      this.currentModel = null;
    }
  }

  /**
   * Switches the current OCR model to the specified one.
   */
  public async switchModel(newModel: string): Promise<void> {
    if (!this.ocrClient) {
      throw new Error('OCR client is not initialized');
    }

    // Load the model only if it's different
    if (this.currentModel !== newModel) {
      await this.loadModel(newModel);
    }
  }

  public getCurrentModel(): string | null {
    return this.currentModel;
  }

  /**
   * Safely executes a function and returns a default value if it fails
   */
  private safeExecute<T>(fn: () => T, defaultValue: T): T {
    try {
      return fn();
    } catch (error) {
      console.error('Error executing function:', error);
      return defaultValue;
    }
  }

  /**
  * Parses the HOCR document and extracts text and line information.
  */
  public parseHOCRContent(hocrContent: string, type: 'national' | 'laser'): HOCRResult {
    const startTime = performance.now();
    return this.safeExecute(
      () => {
        const doc = new DOMParser().parseFromString(hocrContent, 'text/html');
        const lines = this.extractLines(doc);
        const combinedText = this.combineText(lines);
        const idInfo = type === 'national' ? this.locateNationalId(lines) : this.locateLaserId(lines);
        const processingTimeMs = performance.now() - startTime;

        return {
          processingTimeMs,
          extractedText: combinedText,
          lines,
          idInfo,
        };
      },
      {
        processingTimeMs: 0,
        extractedText: '',
        lines: [],
        idInfo: {
          idNumber: '',
          lineId: '',
          boundingBox: { x1: 0, y1: 0, x2: 0, y2: 0 },
        },
      }
    );
  }

  /**
   * Extracts lines from the HOCR document
   */
  private extractLines(doc: Document): HOCRLine[] {
    return Array.from(doc.querySelectorAll('div.ocr_carea')).flatMap(area =>
      Array.from(area.querySelectorAll('span.ocr_line')).map(line =>
        this.createLineObject(line, area.id)
      )
    );
  }

  /**
   * Creates a line object from an HOCR line element
   */
  private createLineObject(line: Element, blockId: string): HOCRLine {
    const words = this.extractWords(line, blockId);
    return {
      lineId: line.id,
      text: words.map(word => word.text).join(''),
      words,
    };
  }

  /**
   * Extracts words from an HOCR line element
   */
  private extractWords(line: Element, blockId: string): HOCRWord[] {
    return Array.from(line.querySelectorAll('span.ocrx_word')).map(word =>
      this.createWordObject(word, blockId, line.id)
    );
  }

  /**
   * Creates a word object from an HOCR word element
   */
  private createWordObject(wordElement: Element, blockId: string, lineId: string): HOCRWord {
    const attributes = wordElement.getAttribute('title') ?? '';
    return {
      id: wordElement.id,
      text: wordElement.textContent?.trim() ?? '',
      boundingBox: this.extractBoundingBox(attributes),
      confidence: this.extractConfidence(attributes),
      blockId,
      lineId,
    };
  }

  /**
   * Extracts bounding box coordinates from attributes string
   */
  private extractBoundingBox(attributes: string): number[] {
    return this.safeExecute(() => {
      const match = attributes.match(this.BBOX_PATTERN);
      return match ? match.slice(1).map(Number) : [];
    }, []);
  }

  /**
   * Extracts confidence score from attributes string
   */
  private extractConfidence(attributes: string): number {
    return this.safeExecute(() => {
      const match = attributes.match(this.CONFIDENCE_PATTERN);
      return match ? Number(match[1]) : 0;
    }, 0);
  }

  /**
   * Combines text from all lines into a single string
   */
  private combineText(lines: HOCRLine[]): string {
    return lines
      .map(line => line.text)
      .join(' ')
      .trim();
  }

  /**
   * Extracts and validates Thai national ID number
   */
  private extractThaiIdNumber(text: string): string {
    // Implementation for Thai ID validation
    // Add your specific validation logic here
    return '';
  }

  /**
   * Extracts and validates laser ID number
   */
  private extractLaserIdNumber(text: string): string {
    // Implementation for laser ID validation
    // Add your specific validation logic here
    return '';
  }

  /**
   * Locates national ID in the document
   */
  private locateNationalId(lines: HOCRLine[]): HOCRResult['idInfo'] {
    for (const line of lines) {
      const nationalId = this.extractThaiIdNumber(line.text);
      if (nationalId) {
        const matchIndex = line.text.indexOf(nationalId);
        const boundingBox = this.computeBoundingBox(line, matchIndex, nationalId.length);
        if (boundingBox) {
          return {
            lineId: line.lineId,
            idNumber: nationalId,
            boundingBox: {
              x1: boundingBox[0],
              y1: boundingBox[1],
              x2: boundingBox[2],
              y2: boundingBox[3],
            },
          };
        }
      }
    }
    return {
      idNumber: '',
      lineId: '',
      boundingBox: { x1: 0, y1: 0, x2: 0, y2: 0 },
    };
  }

  /**
   * Locates laser ID in the document
   */
  private locateLaserId(lines: HOCRLine[]): HOCRResult['idInfo'] {
    for (const line of lines) {
      const laserId = this.extractLaserIdNumber(line.text);
      if (laserId) {
        const matchIndex = line.text.indexOf(laserId);
        const boundingBox = this.computeBoundingBox(line, matchIndex, laserId.length);
        if (boundingBox) {
          return {
            lineId: line.lineId,
            idNumber: laserId,
            boundingBox: {
              x1: boundingBox[0],
              y1: boundingBox[1],
              x2: boundingBox[2],
              y2: boundingBox[3],
            },
          };
        }
      }
    }

    return {
      idNumber: '',
      lineId: '',
      boundingBox: { x1: 0, y1: 0, x2: 0, y2: 0 },
    };
  }

  /**
   * Computes bounding box for a text range within a line
   */
  private computeBoundingBox(line: HOCRLine, startIndex: number, length: number): number[] | null {
    const relevantWords = line.words.filter(word => {
      const wordStartIndex = line.text.indexOf(word.text);
      const wordEndIndex = wordStartIndex + word.text.length;
      return wordEndIndex > startIndex && wordStartIndex < startIndex + length;
    });

    if (!relevantWords.length) {
      return null;
    }

    return relevantWords.reduce(
      ([minX, minY, maxX, maxY], word) => [
        Math.min(minX, word.boundingBox[0]),
        Math.min(minY, word.boundingBox[1]),
        Math.max(maxX, word.boundingBox[2]),
        Math.max(maxY, word.boundingBox[3]),
      ],
      [Infinity, Infinity, -Infinity, -Infinity]
    );
  }

  // ============================== VALIDATION ==============================

  /**
 * Validate and process Thai ID card frame
 */
  public async validateIdCardFrame(
    hocrResult: HOCRResult,
    base64Image: string,
    startTime: number,
    videoElement: ElementRef<HTMLVideoElement>,
    idNumberElement: ElementRef<HTMLElement>
  ) {
    const { extractedText, idInfo } = hocrResult;
    const { boundingBox } = idInfo;

    // Extract and validate ID number
    const idNumber = this.cardRegExpService.extractThaiIdNumber(extractedText);
    const isValidId = this.cardRegExpService.validThaiIdNumber(idNumber);
    const detectedWords = this.cardRegExpService.detectEnglishWords(extractedText);

    // Validate card dimensions
    // const dimensionsValidation = await this.idValidator.validateCardDimensions(
    //   boundingBox,
    //   videoElement.nativeElement,
    //   idNumberElement.nativeElement
    // );

    // Determine final processing state
    const finalState = this.determineProcessingState(
      extractedText,
      isValidId,
      detectedWords.length >= VALIDATION_CONSTANTS.MIN_DETECTED_WORDS,
      true
    );

    return {
      state: finalState,
      base64Image: base64Image,
      processingTimeMs: performance.now() - startTime,
      extractedText,
      isValid: isValidId,
      ocrData: {
        idNumber,
        detectedWords,
        idNumberBoundingBox: boundingBox,
        // cardDimensions: dimensionsValidation
      }
    };
  }

  /**
   * Determine the final processing state based on validation results
   */

  private determineProcessingState(
    extractedText: string,
    isValidId: boolean,
    hasRequiredWords: boolean,
    isValidSize: boolean
  ): ProcessingState {
    // Your existing state determination logic
    if (!extractedText) return ProcessingState.TEXT_NOT_FOUND;
    if (extractedText.length <= 20) return ProcessingState.TEXT_NOT_ENOUGH;
    if (!isValidId) return ProcessingState.INVALID_FORMAT;
    return hasRequiredWords ? ProcessingState.PASSED : ProcessingState.WORD_NOT_ENOUGH;
  }
}
