import { Injectable } from '@angular/core';
import { BoundingBox } from '../lib/types/ocr.types';
import { assertThaiId, PASSPORT_CARD_REGEX, THAI_ID_APPLE_FRONT_REGEX, THAI_ID_REGEX } from '../lib/constants/ocr.expression';


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

export interface HOCRResult {
  processingTimeMs: number;
  extractedText: string;
  lines: HOCRLine[];
  nationalIdInfo: {
    nationalId?: string;
    laserId?: string;
    lineId: string;
    boundingBox: BoundingBox;
  };
}

@Injectable({
  providedIn: 'root',
})
export class CardRegExpService {
  private readonly BBOX_PATTERN = /bbox (\d+) (\d+) (\d+) (\d+)/;
  private readonly CONFIDENCE_PATTERN = /x_wconf (\d+)/;

  constructor() { }

  public extractThaiIdNumber(text: string): string {
    return this.extractIdNumber(text, THAI_ID_REGEX.DIGIT);
  }

  public extractLaserIdNumber(text: string): string {
    const cleanedText = this.cleanLaserIdText(text);
    return this.extractIdNumber(cleanedText, THAI_ID_REGEX.DIGIT_BACK_CARD);
  }

  public cleanLaserIdText(text: string): string {
    return text.replace(/[-—–―‒ ]/g, '');
  }

  public cleanFormatLaserCode(laserCode: string): string {
    return laserCode.replace(/-/g, '').replace(/^(.{2})[Oo]/, '$10');
  }

  private extractIdNumber(text: string, regex: RegExp): string {
    const cleanedText = text.replace(/ /g, '');
    if (!cleanedText) return '';

    const match = cleanedText.match(regex);
    return match ? match[0] : '';
  }

  public findThaiWords(text: string): string[] {
    return this.findWords(text, THAI_ID_REGEX.WORDS_THAI);
  }

  public findEnglishWords(text: string): string[] {
    return this.findWords(text, THAI_ID_REGEX.WORDS_ENG);
  }

  public findEngWordsApple(text: string): string[] {
    return this.findWords(text, THAI_ID_APPLE_FRONT_REGEX.WORDS);
  }

  private findWords(text: string, regex: RegExp): string[] {
    return text.match(regex) || [];
  }

  public isValidThaiIdNumber(text: string): boolean {
    return this.safeExecute(() => assertThaiId(text), false);
  }

  public extractPassportInfo(text: string): string[] {
    const mrz1Match = text.match(PASSPORT_CARD_REGEX.MRZ1);
    return mrz1Match || [];
  }

  /**
   * Parses the HOCR document and extracts text and line information.
   */
  public parseHOCR(hocrContent: string, type: 'national' | 'laser'): HOCRResult {
    const startTime = performance.now();
    return this.safeExecute(
      () => {
        const doc = new DOMParser().parseFromString(hocrContent, 'text/html');
        const lines = this.extractLines(doc);
        const combinedText = this.combineText(lines);
        const nationalIdInfo = type === 'national' ? this.locateNationalId(lines) : this.locateLaserId(lines);

        return {
          processingTimeMs: startTime,
          extractedText: combinedText,
          lines,
          nationalIdInfo,
        };
      },
      {
        processingTimeMs: startTime,
        extractedText: '',
        lines: [],
        nationalIdInfo: {
          nationalId: '',
          lineId: '',
          boundingBox: { x1: 0, y1: 0, x2: 0, y2: 0 },
        },
      },
    );
  }

  private extractLines(doc: Document): HOCRLine[] {
    return Array.from(doc.querySelectorAll('div.ocr_carea')).flatMap(area =>
      Array.from(area.querySelectorAll('span.ocr_line')).map(line => this.createLineObject(line, area.id)),
    );
  }

  private createLineObject(line: Element, blockId: string): HOCRLine {
    const words = this.extractWords(line, blockId);
    return {
      lineId: line.id,
      text: words.map(word => word.text).join(''),
      words,
    };
  }

  private extractWords(line: Element, blockId: string): HOCRWord[] {
    return Array.from(line.querySelectorAll('span.ocrx_word')).map(word =>
      this.createWordObject(word, blockId, line.id),
    );
  }

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

  private extractBoundingBox(attributes: string): number[] {
    return this.safeExecute(() => {
      const match = attributes.match(this.BBOX_PATTERN);
      return match ? match.slice(1).map(Number) : [];
    }, []);
  }

  private extractConfidence(attributes: string): number {
    return this.safeExecute(() => {
      const match = attributes.match(this.CONFIDENCE_PATTERN);
      return match ? Number(match[1]) : 0;
    }, 0);
  }

  private combineText(lines: HOCRLine[]): string {
    return lines
      .map(line => line.text)
      .join(' ')
      .trim();
  }

  private locateNationalId(lines: HOCRLine[]): HOCRResult['nationalIdInfo'] {
    for (const line of lines) {
      const nationalId = this.extractThaiIdNumber(line.text);
      if (nationalId) {
        const matchIndex = line.text.indexOf(nationalId);
        const boundingBox = this.computeBoundingBox(line, matchIndex, nationalId.length);
        if (boundingBox) {
          return {
            lineId: line.lineId,
            nationalId: nationalId,
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
      nationalId: '',
      lineId: '',
      boundingBox: { x1: 0, y1: 0, x2: 0, y2: 0 },
    };
  }

  private locateLaserId(lines: HOCRLine[]): HOCRResult['nationalIdInfo'] {
    for (const line of lines) {
      const laserId = this.extractLaserIdNumber(line.text);
      if (laserId) {
        const matchIndex = line.text.indexOf(laserId);
        const boundingBox = this.computeBoundingBox(line, matchIndex, laserId.length);
        if (boundingBox) {
          return {
            lineId: line.lineId,
            laserId: laserId,
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
      laserId: '',
      lineId: '',
      boundingBox: { x1: 0, y1: 0, x2: 0, y2: 0 },
    };
  }

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
      [Infinity, Infinity, -Infinity, -Infinity],
    );
  }

  private safeExecute<T>(fn: () => T, defaultValue: T): T {
    try {
      return fn();
    } catch (error) {
      console.error('An error occurred during OCR processing:', error);
      return defaultValue;
    }
  }
}
