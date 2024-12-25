// Select DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const switchCameraButton = document.getElementById('switch-camera');
const capturePhotoButton = document.getElementById('capture-photo');

// Fix for iOS Safari
enableIOSVideoAttributes(video);

let currentStream;
let useFrontCamera = false;

// Deuteranopia RGB transformation matrix
const colorMatrix = [
    [0.33066007, 0.66933993, 0],
    [0.33066007, 0.66933993, 0],
    [-0.02785538, 0.02785538, 1]
];

function enableIOSVideoAttributes(videoElement) {
    videoElement.setAttribute('autoplay', '');
    videoElement.setAttribute('muted', '');
    videoElement.setAttribute('playsinline', '');
}

function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: { facingMode: useFrontCamera ? 'user' : 'environment' }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;
            video.play();
        })
        .catch(err => {
            console.error("Error accessing camera: ", err);
        });
}

function applyFilterToImageData(imageData, transformationMatrix) {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        data[i] = transformationMatrix[0][0] * r + transformationMatrix[0][1] * g + transformationMatrix[0][2] * b;
        data[i + 1] = transformationMatrix[1][0] * r + transformationMatrix[1][1] * g + transformationMatrix[1][2] * b;
        data[i + 2] = transformationMatrix[2][0] * r + transformationMatrix[2][1] * g + transformationMatrix[2][2] * b;
    }

    return imageData;
}

function drawFilteredFrame() {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const filteredData = applyFilterToImageData(imageData, colorMatrix);
        ctx.putImageData(filteredData, 0, 0);
    }
    requestAnimationFrame(drawFilteredFrame);
}

function capturePhoto() {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const filteredData = applyFilterToImageData(imageData, colorMatrix);
        ctx.putImageData(filteredData, 0, 0);

        const dataURL = canvas.toDataURL('image/png');
        downloadImage(dataURL, 'photo.png');
    }
}

function downloadImage(dataURL, filename) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    link.click();
}

function handleSwitchCamera() {
    useFrontCamera = !useFrontCamera;
    startCamera();
}

video.addEventListener('play', () => {
    function waitForVideoReady() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            drawFilteredFrame();
        } else {
            requestAnimationFrame(waitForVideoReady);
        }
    }
    waitForVideoReady();
});

switchCameraButton.addEventListener('click', handleSwitchCamera);
capturePhotoButton.addEventListener('click', capturePhoto);

startCamera();
