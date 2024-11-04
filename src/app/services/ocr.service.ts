import { Injectable } from '@angular/core';
import { OCRClient } from 'tesseract-wasm';
import { THA_FAST_MODEL, workerURL } from '../lib/constants/tesseract';

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  private ocrClient: OCRClient | null = null;
  private currentModel: string | null = null;

  constructor() { }

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

  getCurrentModel(): string | null {
    return this.currentModel;
  }
}
