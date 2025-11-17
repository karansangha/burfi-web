// Select DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const switchCameraButton = document.getElementById('switch-camera');
const capturePhotoButton = document.getElementById('capture-photo');

// Make sure your HTML video tag has: <video autoplay muted playsinline></video>
enableIOSVideoAttributes(video);

let currentStream;
let useFrontCamera = false;
let animationFrameId = null;

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
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // *** SIMPLIFIED CONSTRAINTS ***
    // This is more compatible than asking for an "ideal" size
    const constraints = {
        video: {
            facingMode: useFrontCamera ? 'user' : 'environment'
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;

            video.addEventListener('canplay', () => {
                if (!animationFrameId) {
                    drawFilteredFrame();
                }
            }, { once: true });

            video.play();
        })
        .catch(err => {
            // *** THIS IS THE MOST IMPORTANT CHANGE ***
            // This will show you the error on your phone
            console.error("Error accessing camera: ", err);
            alert("Camera Error: " + err.name + "\n\n" + err.message);
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
    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const filteredData = applyFilterToImageData(imageData, colorMatrix);
            ctx.putImageData(filteredData, 0, 0);
        } catch (e) {
            console.error("Error processing frame: ", e);
        }
    }
    animationFrameId = requestAnimationFrame(drawFilteredFrame);
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

switchCameraButton.addEventListener('click', handleSwitchCamera);
capturePhotoButton.addEventListener('click', capturePhoto);

startCamera();
