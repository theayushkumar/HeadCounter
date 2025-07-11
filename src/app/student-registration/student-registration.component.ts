// student-registration.component.ts (with live face detection loop + reset)
import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-student-registration',
  templateUrl: './student-registration.component.html',
  styleUrls: ['./student-registration.component.scss'],
  standalone: false,
})
export class StudentRegistrationComponent implements OnInit, AfterViewInit {
  @ViewChild('videoElement') videoElement!: ElementRef;
  @ViewChild('canvasElement') canvasElement!: ElementRef;

  studentName: string = '';
  isCameraReady = false;
  message = '';
  detecting = false;

  async ngOnInit() {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models'),
    ]);
  }

  ngAfterViewInit() {
    this.startCamera();
  }

  startCamera() {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        const video = this.videoElement.nativeElement;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
          this.isCameraReady = true;
          this.detecting = true;
          this.detectFaceLoop();
        };
      });
  }

  async detectFaceLoop() {
    if (!this.detecting) return;

    const video = this.videoElement.nativeElement;
    const canvas: HTMLCanvasElement = this.canvasElement.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const detections = await faceapi
      .detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.6,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 1) {
      const resized = faceapi.resizeResults(detections[0], {
        width: canvas.width,
        height: canvas.height,
      });

      const box = resized.detection.box;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const distance = Math.hypot(faceCenterX - centerX, faceCenterY - centerY);

      const leftEye = detections[0].landmarks.getLeftEye();
      const rightEye = detections[0].landmarks.getRightEye();
      const eyeTilt = Math.abs(leftEye[0].y - rightEye[3].y);

      if (distance < 100 && eyeTilt < 15) {
        const drawBox = new faceapi.draw.DrawBox(box, {
          label: 'Face Detected',
          boxColor: 'green',
        });
        drawBox.draw(canvas);
      }
    }

    requestAnimationFrame(() => this.detectFaceLoop());
  }

  async captureAndSave() {
    const video = this.videoElement.nativeElement;
    const canvas: HTMLCanvasElement = this.canvasElement.nativeElement;

    const detections = await faceapi
      .detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.6,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length !== 1) {
      this.message = '❌ Face not properly detected. Ensure one centered face.';
      return;
    }

    const resized = faceapi.resizeResults(detections[0], {
      width: canvas.width,
      height: canvas.height,
    });
    const box = resized.detection.box;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    const distance = Math.hypot(faceCenterX - centerX, faceCenterY - centerY);

    const leftEye = detections[0].landmarks.getLeftEye();
    const rightEye = detections[0].landmarks.getRightEye();
    const eyeTilt = Math.abs(leftEye[0].y - rightEye[3].y);

    if (distance > 100 || eyeTilt > 15) {
      this.message = '⚠️ Face not centered or tilted. Try again.';
      return;
    }

    // Save clean image
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = video.videoWidth;
    snapshotCanvas.height = video.videoHeight;
    const snapshotCtx = snapshotCanvas.getContext('2d');

    if (snapshotCtx) {
      snapshotCtx.drawImage(
        video,
        0,
        0,
        snapshotCanvas.width,
        snapshotCanvas.height
      );
      const base64Image = snapshotCanvas.toDataURL('image/jpeg');
      this.saveToIndexedDB(this.studentName.trim(), base64Image);
      this.message = `✅ ${this.studentName} registered`;
      this.resetForm();
    } else {
      this.message = '❌ Error capturing image';
    }
  }

  resetForm() {
    this.studentName = '';
    const canvas = this.canvasElement.nativeElement as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  saveToIndexedDB(name: string, base64Image: string) {
    const openRequest = indexedDB.open('FaceDB', 1);

    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: 'name' });
      }
    };

    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const tx = db.transaction('students', 'readwrite');
      const store = tx.objectStore('students');
      store.put({ name, image: base64Image });
      tx.oncomplete = () => console.log(`✅ Saved ${name} to IndexedDB`);
    };
  }
}
