// Select DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const switchCameraButton = document.getElementById('switch-camera');
const capturePhotoButton = document.getElementById('capture-photo');

// Fix for iOS Safari (and good practice)
enableIOSVideoAttributes(video);

let currentStream;
let useFrontCamera = false;
let animationFrameId = null; // To control the animation loop

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
    // Stop any existing stream and animation loop
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    const constraints = {
        video: {
            facingMode: useFrontCamera ? 'user' : 'environment',
            width: { ideal: 1280 }, // Requesting a size can sometimes help
            height: { ideal: 720 }
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;

            // Wait for the video to be ready to play
            video.addEventListener('canplay', () => {
                // Check if we are already drawing
                if (!animationFrameId) {
                    drawFilteredFrame();
                }
            }, { once: true }); // Use { once: true } so it only fires once per stream

            video.play();
        })
        .catch(err => {
            console.error("Error accessing camera: ", err);
            // You could display an error to the user here
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
    // Check if the video is ready and has dimensions
    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        // Set canvas dimensions *once* or check if they've changed
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

    // Continue the loop
    animationFrameId = requestAnimationFrame(drawFilteredFrame);
}

function capturePhoto() {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Ensure canvas is the right size (it should be, but just in case)
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw one last time to make sure it's the current frame
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
    startCamera(); // This will stop the old stream and start a new one
}

// Remove the old 'play' listener
// video.addEventListener('play', ...); 

switchCameraButton.addEventListener('click', handleSwitchCamera);
capturePhotoButton.addEventListener('click', capturePhoto);

// Initial start
startCamera();
