// WebGL logic for Dog Vision Filter
// This replaces the CSS filter approach to guarantee performance and compatibility on Safari

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

const switchCameraButton = document.getElementById('camera-toggle');
const capturePhotoButton = document.getElementById('shutter-button');

// State
let currentStream;
let useFrontCamera = false;
let isFilterEnabled = true;

// Shader Sources
const vsSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texCoord = a_texCoord;
    }
`;

// Fragment shader with Deuteranopia matrix AND optional "bypass" uniform
const fsSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform bool u_filterEnabled;
    varying vec2 v_texCoord;

    // Deuteranopia Matrix
    // R' = 0.33R + 0.67G + 0B
    // G' = 0.33R + 0.67G + 0B
    // B' = -0.02R + 0.02G + 1B
    
    void main() {
        vec4 color = texture2D(u_image, v_texCoord);
        
        if (u_filterEnabled) {
            float r = color.r * 0.33066 + color.g * 0.66934;
            float g = color.r * 0.33066 + color.g * 0.66934;
            float b = color.r * -0.02786 + color.g * 0.02786 + color.b;
            gl_FragColor = vec4(r, g, b, color.a);
        } else {
            gl_FragColor = color;
        }
    }
`;

// Helper: Compile Shader
function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Helper: Link Program
function initShaderProgram(gl, vs, fs) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vs);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// WebGL Setup
const program = initShaderProgram(gl, vsSource, fsSource);
const positionLoc = gl.getAttribLocation(program, 'a_position');
const texCoordLoc = gl.getAttribLocation(program, 'a_texCoord');
const imageLoc = gl.getUniformLocation(program, 'u_image');
const filterEnabledLoc = gl.getUniformLocation(program, 'u_filterEnabled');

// Buffers
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
// Two triangles covering the clip space (-1 to 1)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
]), gl.STATIC_DRAW);

const texCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
// Texture coordinates (0 to 1), flipped Y for WebGL
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 1,
    1, 1,
    0, 0,
    0, 0,
    1, 1,
    1, 0,
]), gl.STATIC_DRAW);

// Texture
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
// Set parameters to handle non-power-of-2 images (like video)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);


// Camera Setup
function enableIOSVideoAttributes(videoElement) {
    videoElement.setAttribute('autoplay', '');
    videoElement.setAttribute('muted', '');
    videoElement.setAttribute('playsinline', '');
}
enableIOSVideoAttributes(video);

function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: useFrontCamera ? 'user' : 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;

            // Wait for metadata to resize canvas
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                gl.viewport(0, 0, canvas.width, canvas.height);
            });

            if (useFrontCamera) {
                canvas.classList.add('mirrored');
            } else {
                canvas.classList.remove('mirrored');
            }

            video.play();
            requestAnimationFrame(render);
        })
        .catch(err => {
            console.error("Error accessing camera: ", err);
            alert("Error: " + err.message);
        });
}

function render() {
    if (video.readyState >= video.HAVE_CURRENT_DATA) {
        gl.useProgram(program);

        // Position
        gl.enableVertexAttribArray(positionLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // TexCoord
        gl.enableVertexAttribArray(texCoordLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

        // Upload Video Frame to Texture
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        // Set Uniforms
        gl.uniform1i(imageLoc, 0);
        gl.uniform1i(filterEnabledLoc, isFilterEnabled ? 1 : 0);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    requestAnimationFrame(render);
}

// Interaction Logic
const container = document.querySelector('.container');

function disableFilter() { isFilterEnabled = false; }
function enableFilter() { isFilterEnabled = true; }

container.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    disableFilter();
});
container.addEventListener('mouseup', enableFilter);
container.addEventListener('mouseleave', enableFilter);
container.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    disableFilter();
}, { passive: true });
container.addEventListener('touchend', enableFilter);


// Inputs
switchCameraButton.addEventListener('click', () => {
    useFrontCamera = !useFrontCamera;
    startCamera();
});

capturePhotoButton.addEventListener('click', () => {
    // WebGL canvas can be saved directly
    // Need to handle mirroring if we want the SAVED image to be mirrored (canvas CSS transform doesn't affect toDataURL)
    // For simplicity, we just save what's rendered. To strictly mirror the saved pixels, we'd need a temp canvas or frame buffer.
    // However, usually front-camera photos are SAVED non-mirrored (true life) or mirrored. 
    // Let's just save the canvas as is. 

    // Note: preserveDrawingBuffer needs to be true? Or just capture immediately after render.
    // By default WebGL clears buffer. So we might get black image if we don't capture sync with render.
    // Let's redraw explicitly to be safe.
    render();

    // Create a temp canvas specifically to flip the image if needed for the file
    // Actually, CSS transform on canvas doesn't flip the data URL.
    // If user wants "Selfie Mode" photo to be mirrored, we must do it manually.

    let finalDataURL;

    if (useFrontCamera) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.translate(canvas.width, 0);
        tCtx.scale(-1, 1);
        tCtx.drawImage(canvas, 0, 0);
        finalDataURL = tempCanvas.toDataURL('image/png');
    } else {
        finalDataURL = canvas.toDataURL('image/png');
    }

    const link = document.createElement('a');
    link.href = finalDataURL;
    link.download = `dog-vision-${Date.now()}.png`;
    link.click();
});

startCamera();
