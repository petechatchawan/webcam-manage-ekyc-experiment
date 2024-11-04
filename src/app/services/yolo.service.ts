import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
declare var cv: any;

@Injectable({
  providedIn: 'root',
})
export class YoloService {
  model: any = {
    net: null,
    inputShape: [1, 640, 640, 3],
  };

  classNames: string[] = ['driving_license', 'id_card', 'passport'];

  constructor() { }

  async loadModel() {
    await tf.ready();

    // Load YOLOv5 model
    this.model.net = await tf.loadGraphModel('../../../assets/models/model.json', {
      onProgress: (fraction: any) => {
        console.log(`Model loading progress: ${(fraction * 100).toFixed(2)}%`);
      },
    });

    // Warm up the model
    const dummyInput = tf.ones([1, 640, 640, 3]);
    await this.model.net.executeAsync(dummyInput);
    tf.dispose(dummyInput);
    console.log('YOLO model loaded successfully');
  }

  async processYolo(img: any): Promise<{ type: string, score: number, width: number, height: number }> {
    const inputSize = 640;
    const resizedYOLOImg = new cv.Mat();

    // Resize image for YOLO input size
    cv.resize(img, resizedYOLOImg, new cv.Size(inputSize, inputSize));

    // Create a canvas to extract the image data
    const canvas = document.createElement('canvas');
    canvas.width = resizedYOLOImg.cols;
    canvas.height = resizedYOLOImg.rows;
    cv.imshow(canvas, resizedYOLOImg);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas 2D context');
      resizedYOLOImg.delete();
      return { type: '', score: 0, width: 0, height: 0 };
    }

    // Get image data from canvas for YOLO input
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Convert image to TensorFlow tensor for YOLO input
    const inputTensor = tf.tidy(() => {
      return tf.browser.fromPixels(imageData).expandDims(0).div(255.0);
    });

    try {
      const predictions = await this.model.net.executeAsync(inputTensor);

      // Log predictions for debugging
      const boxes = await predictions[0].array();
      const scores = await predictions[1].array();
      const classes = await predictions[2].array();

      let detectionCount = 0;
      let result = { type: '', score: 0, width: 0, height: 0 }
      for (let i = 0; i < boxes[0].length; i++) {
        if (scores[0][i] > 0.4) {
          detectionCount++;
          const [ymin, xmin, ymax, xmax] = boxes[0][i];

          // Use coordinates directly from YOLO output, since they're relative to the resized image
          const y1 = Math.round(xmin * inputSize);
          const x1 = Math.round(ymin * inputSize);
          const y2 = Math.round(xmax * inputSize);
          const x2 = Math.round(ymax * inputSize);

          // Draw bounding box for YOLO detections
          const boundingColor = new cv.Scalar(0, 255, 0);
          cv.rectangle(
            resizedYOLOImg, // Draw on the resized image
            new cv.Point(x1, y1),
            new cv.Point(x2, y2),
            boundingColor,
            2
          );

          const classIndex = classes[0][i];
          const className = this.classNames[classIndex];
          const label = `${className}: ${scores[0][i].toFixed(2)} `;
          cv.putText(
            resizedYOLOImg,
            label,
            new cv.Point(x1, y1 - 10),
            cv.FONT_HERSHEY_SIMPLEX,
            0.5,
            boundingColor,
            2
          );

          // Calculate the width and height of the detected card in the original image
          const width = (xmax - xmin) * img.cols;
          const height = (ymax - ymin) * img.rows;
          cv.putText(
            resizedYOLOImg,
            `Width: ${width.toFixed(2)}px, Height: ${height.toFixed(2)}px`,
            new cv.Point(x1, y1 - 30),
            cv.FONT_HERSHEY_SIMPLEX,
            0.5,
            boundingColor,
            2
          )

          result = {
            type: className,
            score: scores[0][i],
            width: width,
            height: height
          }
        }
      }


      // Convert the processed resized image to a data URL
      return result;
    } catch (err) {
      console.error('Error in YOLO inference:', err);
      return { type: '', score: 0, width: 0, height: 0 };
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
