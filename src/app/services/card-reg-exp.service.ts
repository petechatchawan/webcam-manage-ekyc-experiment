import { Injectable } from '@angular/core';
import { assertThaiId, PASSPORT_CARD_REGEX, THAI_ID_APPLE_FRONT_REGEX, THAI_ID_REGEX } from '../lib/constants/ocr.expression';


@Injectable({
  providedIn: 'root',
})
export class CardRegExpService {

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

  public detectThaiWords(text: string): string[] {
    return this.detectWords(text, THAI_ID_REGEX.WORDS_THAI);
  }

  public detectEnglishWords(text: string): string[] {
    return this.detectWords(text, THAI_ID_REGEX.WORDS_ENG);
  }

  public detectEngWordsApple(text: string): string[] {
    return this.detectWords(text, THAI_ID_APPLE_FRONT_REGEX.WORDS);
  }

  private detectWords(text: string, regex: RegExp): string[] {
    return text.match(regex) || [];
  }

  public validThaiIdNumber(text: string): boolean {
    return this.safeExecute(() => assertThaiId(text), false);
  }

  public extractPassportInfo(text: string): string[] {
    const mrz1Match = text.match(PASSPORT_CARD_REGEX.MRZ1);
    return mrz1Match || [];
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
