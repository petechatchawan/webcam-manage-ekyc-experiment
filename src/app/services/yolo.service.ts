// import { Injectable } from '@angular/core';
// import * as tf from '@tensorflow/tfjs';
// declare var cv: any;

// Types and interfaces
type Point = { x: number, y: number };
type Dimension = { width: number, height: number };

interface Detection {
  boundingBox: {
    topLeft: Point;
    bottomRight: Point;
  };
  class: string;
  confidence: number;
  dimensions: Dimension;
}

export interface DetectionResult {
  documentType: string;
  confidence: number;
  dimensions: Dimension;
  processingTimeMs: number;
}

interface ModelConfig {
  net: any;
  inputSize: number;
  confidenceThreshold: number;
  classNames: readonly string[];
}


const DEFAULT_RESULT: DetectionResult = {
  documentType: '',
  confidence: 0,
  dimensions: { width: 0, height: 0 },
  processingTimeMs: 0
};

import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
declare var cv: any;

@Injectable({
  providedIn: 'root',
})
export class YoloService {
  private readonly classNames: string[] = ['bank_acc', 'card_id', 'copy_bank_acc', 'copy_card_id', 'copy_driving_license', 'copy_passport', 'driving_license', 'glasses', 'hat', 'mask', 'passport', 'sunglasses'];
  private readonly config: ModelConfig = {
    net: null,
    inputSize: 224,
    confidenceThreshold: 0.4,
    classNames: [
      'bank_acc',
      'card_id',
      'copy_bank_acc',
      'copy_card_id',
      'copy_driving_license',
      'copy_passport',
      'driving_license',
      'glasses',
      'hat',
      'mask',
      'passport',
      'sunglasses'
    ] as const
  };


  constructor() { }

  async initialize() {
    await tf.ready();

    // Load YOLOv5 model
    this.config.net = await tf.loadGraphModel('../../../assets/models/model.json', {
      onProgress: (fraction) => {
        console.log(`Model loading progress: ${(fraction * 100).toFixed(2)}%`);
      },
    });

    // Warm up the model
    const dummyInput = tf.ones([1, this.config.inputSize, this.config.inputSize, 3]);
    await this.config.net.executeAsync(dummyInput);
    tf.dispose(dummyInput);
    console.log('YOLO model loaded successfully');
  }

  async detectDocument(img: any): Promise<DetectionResult> {
    const startTimeMs = performance.now();
    let resizedYOLOImg = new cv.Mat();

    // Resize image for YOLO input size
    const { inputSize } = this.config;
    cv.resize(img, resizedYOLOImg, new cv.Size(inputSize, inputSize));

    // Apply Gaussian blur
    const blurredImg = new cv.Mat();
    cv.GaussianBlur(resizedYOLOImg, blurredImg, new cv.Size(3, 3), 3);
    resizedYOLOImg = blurredImg;

    // Create a canvas to extract the image data
    const canvas = document.createElement('canvas');
    canvas.width = resizedYOLOImg.cols;
    canvas.height = resizedYOLOImg.rows;
    cv.imshow(canvas, resizedYOLOImg);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas 2D context');
      resizedYOLOImg.delete();
      return {
        ...DEFAULT_RESULT,
        processingTimeMs: performance.now() - startTimeMs
      };
    }

    // Get image data from canvas for YOLO input
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Convert image to TensorFlow tensor for YOLO input
    const inputTensor = tf.tidy(() => {
      return tf.browser.fromPixels(imageData).expandDims(0).div(255.0);
    });

    try {
      const predictions = await this.config.net.executeAsync(inputTensor);

      // Log predictions for debugging
      const boxes = await predictions[0].array();
      const scores = await predictions[1].array();
      const classes = await predictions[2].array();

      let detectionCount = 0;
      let detectionResult: DetectionResult = {
        ...DEFAULT_RESULT,
        processingTimeMs: performance.now() - startTimeMs
      };

      for (let i = 0; i < boxes[0].length; i++) {
        if (scores[0][i] > 0.4) {
          detectionCount++;
          const [ymin, xmin, ymax, xmax] = boxes[0][i];

          // Use coordinates directly from YOLO output, since they're relative to the resized image
          // const y1 = Math.round(xmin * this.config.inputSize);
          // const x1 = Math.round(ymin * this.config.inputSize);
          // const y2 = Math.round(xmax * this.config.inputSize);
          // const x2 = Math.round(ymax * this.config.inputSize);

          // Draw bounding box for YOLO detections
          // const boundingColor = new cv.Scalar(0, 255, 0);
          // cv.rectangle(
          //   resizedYOLOImg, // Draw on the resized image
          //   new cv.Point(x1, y1),
          //   new cv.Point(x2, y2),
          //   boundingColor,
          //   2
          // );

          const classIndex = classes[0][i];
          const className = this.classNames[classIndex];
          const label = `${className}: ${scores[0][i].toFixed(2)} `;
          // cv.putText(
          //   resizedYOLOImg,
          //   label,
          //   new cv.Point(x1, y1 - 10),
          //   cv.FONT_HERSHEY_SIMPLEX,
          //   0.5,
          //   boundingColor,
          //   2
          // );

          // Calculate the width and height of the detected card in the original image
          const width = (xmax - xmin) * img.cols;
          const height = (ymax - ymin) * img.rows;
          // cv.putText(
          //   resizedYOLOImg,
          //   `Width: ${width.toFixed(2)}px, Height: ${height.toFixed(2)}px`,
          //   new cv.Point(x1, y1 - 30),
          //   cv.FONT_HERSHEY_SIMPLEX,
          //   0.5,
          //   boundingColor,
          //   2
          // )

          detectionResult = {
            documentType: className,
            confidence: scores[0][i],
            dimensions: { width: width, height: height },
            processingTimeMs: performance.now() - startTimeMs,
          }
        }
      }


      // Convert the processed resized image to a data URL
      return detectionResult;
    } catch (err) {
      console.error('Error in YOLO inference:', err);
      return {
        ...DEFAULT_RESULT,
        processingTimeMs: performance.now() - startTimeMs
      };
    } finally {
      resizedYOLOImg.delete();
      tf.dispose(inputTensor);
    }
  }

  private convertMatToImage(mat: any): string {
    if (!mat || mat.isDeleted()) {
      console.error('Mat object has been deleted or is null, cannot convert to image');
      return '';
    }

    const canvas = document.createElement('canvas');
    cv.imshow(canvas, mat);
    const imageData = canvas.toDataURL();

    // Clean up the temporary canvas
    canvas.remove();

    return imageData;
  }
}
