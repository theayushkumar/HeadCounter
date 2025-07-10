import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import * as blazeface from '@tensorflow-models/blazeface';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements AfterViewInit {
  @ViewChild('video', { static: false }) video!: ElementRef;
  @ViewChild('canvas', { static: false }) canvas!: ElementRef;

  model: blazeface.BlazeFaceModel | null = null;
  faceCount = 0;

  async ngAfterViewInit() {
    await tf.setBackend('webgl');
    await tf.ready();

    this.model = await blazeface.load();
    this.startCamera();
  }

  async startCamera() {
    const videoEl = this.video.nativeElement as HTMLVideoElement;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    videoEl.srcObject = stream;
    videoEl.play();

    videoEl.onloadeddata = () => {
      this.detectFaces();
    };
  }

  async detectFaces() {
    if (!this.model) return;

    const video = this.video.nativeElement;
    const canvas = this.canvas.nativeElement;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const detectLoop = async () => {
      const inputTensor = tf.browser.fromPixels(video);
      const resized = tf.image.resizeBilinear(inputTensor, [256, 256]); // make small faces detectable

      const predictions = await this.model!.estimateFaces(
        resized,
        false,
        false
      ); // Correct: no options object

      tf.dispose([inputTensor, resized]);
      tf.dispose([inputTensor, resized]);

      // Clear canvas and draw video
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      this.faceCount = predictions.length;

      predictions.forEach((pred: any) => {
        const [xRatio, yRatio] = [
          video.videoWidth / 256,
          video.videoHeight / 256,
        ];

        const start = pred.topLeft as [number, number];
        const end = pred.bottomRight as [number, number];

        const x = start[0] * xRatio;
        const y = start[1] * yRatio;
        const width = (end[0] - start[0]) * xRatio;
        const height = (end[1] - start[1]) * yRatio;

        ctx.beginPath();
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2;
        ctx.rect(x, y, width, height);
        ctx.stroke();
      });

      requestAnimationFrame(detectLoop);
    };

    detectLoop();
  }
}
