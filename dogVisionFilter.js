const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const switchCameraButton = document.getElementById('switch-camera');
const capturePhotoButton = document.getElementById('capture-photo');

let currentStream;
let useFrontCamera = true;

/*
Source - https://mk.bcgsc.ca/colorblind/math.mhtml#projecthome
Based on Martin Krzywinski’s incredible work, this is the RGB transformation matrix 
of a deuteranopia vision
*/
const matrix = [
    [0.33066007, 0.66933993, 0],
    [0.33066007, 0.66933993, 0],
    [-0.02785538, 0.02785538, 1]
];

function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: useFrontCamera ? 'user' : 'environment'
        }
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

function applyDogVisionFilter() {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b;
            data[i + 1] = matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b;
            data[i + 2] = matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b;
        }

        ctx.putImageData(imageData, 0, 0);
    }
    requestAnimationFrame(applyDogVisionFilter);
}

video.addEventListener('play', () => {
    function checkVideoReady() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            applyDogVisionFilter();
        } else {
            requestAnimationFrame(checkVideoReady);
        }
    }
    checkVideoReady();
});

switchCameraButton.addEventListener('click', () => {
    useFrontCamera = !useFrontCamera;
    startCamera();
});

capturePhotoButton.addEventListener('click', () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b;
            data[i + 1] = matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b;
            data[i + 2] = matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b;
        }

        ctx.putImageData(imageData, 0, 0);

        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'photo.png';
        link.click();
    }
});

startCamera();