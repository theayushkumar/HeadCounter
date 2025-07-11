import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

@Component({
  selector: 'app-teacher-attendance',
  templateUrl: './teacher-attendance.component.html',
  styleUrls: ['./teacher-attendance.component.scss'],
  standalone: false,
})
export class TeacherAttendanceComponent implements OnInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

  knownFaces: faceapi.LabeledFaceDescriptors[] = [];
  faceMatcher!: faceapi.FaceMatcher;
  attendance: string[] = [];
  matchMessage: string = '📷 Initializing...';

  async ngOnInit() {
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('✅ TensorFlow.js backend ready');

    await this.loadModels();
    await this.loadKnownFacesFromIndexedDB();
    this.startCamera();
  }

  async loadModels() {
    const MODEL_URL = '/assets/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    console.log('✅ FaceAPI models loaded');
  }

  async loadKnownFacesFromIndexedDB() {
    const openRequest = indexedDB.open('FaceDB', 1);

    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: 'name' });
      }
    };

    openRequest.onsuccess = async () => {
      const db = openRequest.result;
      const tx = db.transaction('students', 'readonly');
      const store = tx.objectStore('students');
      const request = store.getAll();

      request.onsuccess = async () => {
        const students = request.result;

        for (const student of students) {
          try {
            const img = await faceapi.fetchImage(student.image);
            const detection = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection) {
              const labeled = new faceapi.LabeledFaceDescriptors(student.name, [detection.descriptor]);
              this.knownFaces.push(labeled);
              console.log(`✅ Loaded descriptor for ${student.name}`);
            } else {
              console.warn(`⚠️ No face detected in image of ${student.name}`);
            }
          } catch (error) {
            console.error(`❌ Error loading student ${student.name}`, error);
          }
        }

        if (this.knownFaces.length > 0) {
          this.faceMatcher = new faceapi.FaceMatcher(this.knownFaces, 0.6);
          this.matchMessage = '✅ Face matcher ready';
        } else {
          this.matchMessage = '❌ No student faces found';
        }
      };
    };
  }

  startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      const video = this.videoElement.nativeElement;
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        video.width = video.videoWidth;
        video.height = video.videoHeight;

        // Start detection loop after short delay
        setTimeout(() => {
          this.recognitionLoop();
        }, 500);
      };
    });
  }

  recognitionLoop() {
    const video = this.videoElement.nativeElement;
    const canvas = this.overlayCanvas.nativeElement;
    const displaySize = {
      width: video.videoWidth || video.width,
      height: video.videoHeight || video.height
    };

    faceapi.matchDimensions(canvas, displaySize);

    const detectLoop = async () => {
      this.matchMessage = '🔍 Match processing...';

      if (!this.faceMatcher) {
        this.matchMessage = '❌ Face matcher not ready';
        requestAnimationFrame(detectLoop);
        return;
      }

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let matched = false;

      for (const detection of resizedDetections) {
        const result = this.faceMatcher.findBestMatch(detection.descriptor);
        const box = detection.detection.box;

        const label = result.label === 'unknown' ? '❌ No Match' : `✅ ${result.label}`;
        const color = result.label === 'unknown' ? 'red' : 'green';

        const drawBox = new faceapi.draw.DrawBox(box, { label, boxColor: color });
        drawBox.draw(canvas);

        if (result.label !== 'unknown' && !this.attendance.includes(result.label)) {
          this.attendance.push(result.label);
          this.matchMessage = `✅ Attendance done: ${result.label}`;
          matched = true;
          break; // Only one match per frame
        }
      }

      if (!matched && resizedDetections.length > 0) {
        this.matchMessage = '❌ No match';
      } else if (resizedDetections.length === 0) {
        this.matchMessage = '❌ No face detected';
      }

      requestAnimationFrame(detectLoop);
    };

    detectLoop();
  }
}
