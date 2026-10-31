let rawDataBuffer = null;
let currentImageData = null;
let currentZoom = 1;
let dragStart = { x: 0, y: 0 };
let currentPan = { x: 0, y: 0 };

function unpack10BitData(packedData, width, height, stride) {
    const unpacked = new Uint16Array(width * height);
    let outIndex = 0;
    
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col += 4) {
            const i = row * stride + Math.floor(col * 1.25);
            unpacked[outIndex++] = packedData[i] | ((packedData[i+1] & 0x03) << 8);
            unpacked[outIndex++] = ((packedData[i+1] & 0xfc) >> 2) | ((packedData[i+2] & 0x0f) << 6);
            unpacked[outIndex++] = ((packedData[i+2] & 0xf0) >> 4) | ((packedData[i+3] & 0x3f) << 4);
            unpacked[outIndex++] = ((packedData[i+3] & 0xc0) >> 6) | (packedData[i+4] << 2);
        }
    }
    
    return unpacked;
}

// Unpack 12-bit packed data: 2 pixels per 3 bytes
// Mode determines the bit layout within the 3 bytes
function unpack12BitData(packedData, width, height, stride, packMode) {
    const unpacked = new Uint16Array(width * height);
    let outIndex = 0;

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col += 2) {
            const i = row * stride + Math.floor(col * 1.5);
            const b0 = packedData[i];
            const b1 = packedData[i + 1];
            const b2 = packedData[i + 2];

            switch (packMode) {
                case 'mipi':
                    // MIPI CSI-2 RAW12: [P0(11:4)] [P1(11:4)] [P1(3:0)<<4 | P0(3:0)]
                    unpacked[outIndex++] = (b0 << 4) | (b2 & 0x0f);
                    unpacked[outIndex++] = (b1 << 4) | (b2 >> 4);
                    break;
                case 'lowbytes_hinibble':
                    // Low bytes first, high nibbles in 3rd byte: [P0_lo(7:0)] [P1_lo(7:0)] [P1_hi(11:8)<<4 | P0_hi(11:8)]
                    unpacked[outIndex++] = b0 | ((b2 & 0x0f) << 8);
                    unpacked[outIndex++] = b1 | ((b2 & 0xf0) << 4);
                    break;
                case 'highfirst':
                    // High-first: [P0(11:4)] [P0(3:0)<<4 | P1(11:8)] [P1(7:0)]
                    unpacked[outIndex++] = (b0 << 4) | (b1 >> 4);
                    unpacked[outIndex++] = ((b1 & 0x0f) << 8) | b2;
                    break;
                case 'lowfirst':
                    // Low-first: [P0(7:0)] [P0(11:8) | P1(3:0)<<4] [P1(11:4)]
                    unpacked[outIndex++] = b0 | ((b1 & 0x0f) << 8);
                    unpacked[outIndex++] = (b1 >> 4) | (b2 << 4);
                    break;
            }
        }
    }

    return unpacked;
}

// Convert byte array to Uint16Array (little-endian)
// Used for 10-bit, 12-bit, and 14-bit formats stored in 16-bit words
function bytesToUint16Array(packedData, width, height) {
    const unpacked = new Uint16Array(width * height);

    for (let i = 0; i < width * height; i++) {
        unpacked[i] = packedData[i * 2] | (packedData[i * 2 + 1] << 8);
    }

    return unpacked;
}

function simpleDemosaic(bayerData, width, height, pattern, format) {
    const rgbData = new Uint8ClampedArray(width * height * 4);
    
    const patternMap = {
        'RGGB': [[0,0], [1,1]],
        'BGGR': [[1,1], [0,0]],
        'GRBG': [[1,0], [0,1]],
        'GBRG': [[0,1], [1,0]]
    };
    
    const [redOffset, blueOffset] = patternMap[pattern];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            let r, g, b;
            
            const isRedPixel = ((y % 2 === redOffset[1]) && (x % 2 === redOffset[0]));
            const isBluePixel = ((y % 2 === blueOffset[1]) && (x % 2 === blueOffset[0]));
            
            if (isRedPixel) {
                // Red
                r = bayerData[i];
                g = (x > 0 && x < width - 1 && y > 0 && y < height - 1) ? 
                    (bayerData[i-1] + bayerData[i+1] + bayerData[i-width] + bayerData[i+width]) / 4 : bayerData[i];
                b = (x > 0 && x < width - 1 && y > 0 && y < height - 1) ? 
                    (bayerData[i-width-1] + bayerData[i-width+1] + bayerData[i+width-1] + bayerData[i+width+1]) / 4 : bayerData[i];
            } else if (isBluePixel) {
                // Blue
                b = bayerData[i];
                g = (x > 0 && x < width - 1 && y > 0 && y < height - 1) ? 
                    (bayerData[i-1] + bayerData[i+1] + bayerData[i-width] + bayerData[i+width]) / 4 : bayerData[i];
                r = (x > 0 && x < width - 1 && y > 0 && y < height - 1) ? 
                    (bayerData[i-width-1] + bayerData[i-width+1] + bayerData[i+width-1] + bayerData[i+width+1]) / 4 : bayerData[i];
            } else {
                // Green
                g = bayerData[i];
                if ((y % 2 === redOffset[1])) {
                    r = (x > 0 && x < width - 1) ? (bayerData[i-1] + bayerData[i+1]) / 2 : 
                        (y > 0 && y < height - 1) ? (bayerData[i-width] + bayerData[i+width]) / 2 : bayerData[i];
                    b = (y > 0 && y < height - 1) ? (bayerData[i-width] + bayerData[i+width]) / 2 : 
                        (x > 0 && x < width - 1) ? (bayerData[i-1] + bayerData[i+1]) / 2 : bayerData[i];
                } else {
                    b = (x > 0 && x < width - 1) ? (bayerData[i-1] + bayerData[i+1]) / 2 : 
                        (y > 0 && y < height - 1) ? (bayerData[i-width] + bayerData[i+width]) / 2 : bayerData[i];
                    r = (y > 0 && y < height - 1) ? (bayerData[i-width] + bayerData[i+width]) / 2 : 
                        (x > 0 && x < width - 1) ? (bayerData[i-1] + bayerData[i+1]) / 2 : bayerData[i];
                }
            }
            
            const outIndex = i * 4;
            if (format === 'unpacked10' || format === 'packed10') {
                rgbData[outIndex] = r >> 2;     // Convert 10-bit to 8-bit
                rgbData[outIndex + 1] = g >> 2;
                rgbData[outIndex + 2] = b >> 2;
            }
            else if (format === 'unpacked12' || format === 'packed12') {
                rgbData[outIndex] = r >> 4;     // Convert 12-bit to 8-bit
                rgbData[outIndex + 1] = g >> 4;
                rgbData[outIndex + 2] = b >> 4;
            }
            else if (format === 'unpacked14' || format === 'packed14') {
                rgbData[outIndex] = r >> 6;     // Convert 14-bit to 8-bit
                rgbData[outIndex + 1] = g >> 6;
                rgbData[outIndex + 2] = b >> 6;
            }
            else if (format === 'unpacked16') {
                rgbData[outIndex] = r >> 8;     // Convert 16-bit to 8-bit
                rgbData[outIndex + 1] = g >> 8;
                rgbData[outIndex + 2] = b >> 8;
            }
            else {
                rgbData[outIndex] = r;
                rgbData[outIndex + 1] = g;
                rgbData[outIndex + 2] = b;
            }
            rgbData[outIndex + 3] = 255;    // Alpha channel
        }
    }
    
    return rgbData;
}

function subtractOB(data, obValue) {
    return data.map(value => Math.max(0, value - obValue));
}

function applyAWB(rgbData, width, height) {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    
    // Calculate average RGB values
    for (let i = 0; i < rgbData.length; i += 4) {
        rSum += rgbData[i];
        gSum += rgbData[i + 1];
        bSum += rgbData[i + 2];
        count++;
    }
    
    const rAvg = rSum / count;
    const gAvg = gSum / count;
    const bAvg = bSum / count;
    
    // Calculate scaling factors
    const rScale = gAvg / rAvg;
    const bScale = gAvg / bAvg;
    
    // Apply white balance
    for (let i = 0; i < rgbData.length; i += 4) {
        rgbData[i] = Math.min(255, rgbData[i] * rScale);
        rgbData[i + 2] = Math.min(255, rgbData[i + 2] * bScale);
    }
    
    return rgbData;
}

function drawImage(imageData, width, height) {
    const canvas = document.getElementById('imageCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    const imgData = new ImageData(imageData, width, height);
    ctx.putImageData(imgData, 0, 0);
    canvas.style.display = 'block';
    document.getElementById('dropText').style.display = 'none';

    // Store current image data for zooming
    currentImageData = imgData;
    currentZoom = 1;
    currentPan = { x: 0, y: 0 };
    updateCanvasTransform();
}

function updateCanvasTransform() {
    const canvas = document.getElementById('imageCanvas');
    canvas.style.transform = `translate(${currentPan.x}px, ${currentPan.y}px) scale(${currentZoom})`;
}

function zoom(delta, mouseX, mouseY) {
    const zoomFactor = delta > 0 ? 1.1 : 1 / 1.1;
    const newZoom = currentZoom * zoomFactor;

    // Limit zoom level between 0.1 and 10
    if (newZoom >= 0.1 && newZoom <= 10) {
        // Calculate new pan to zoom towards mouse position
        const canvasRect = document.getElementById('imageContainer').getBoundingClientRect();
        const scaleChange = newZoom - currentZoom;
        currentPan.x -= ((mouseX - canvasRect.left - currentPan.x) / currentZoom) * scaleChange;
        currentPan.y -= ((mouseY - canvasRect.top - currentPan.y) / currentZoom) * scaleChange;

        currentZoom = newZoom;
        updateCanvasTransform();
    }
}

function startDrag(e) {
    dragStart = { x: e.clientX - currentPan.x, y: e.clientY - currentPan.y };
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
}

function drag(e) {
    currentPan = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
    updateCanvasTransform();
}

function endDrag() {
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', endDrag);
}

function processRawData(rawData, width, height, stride, pattern, subtractOBFlag, obValue, applyAWBFlag, format, packMode) {
    let unpackedData = null;
    if (format === 'packed10') {
	unpackedData = unpack10BitData(rawData, width, height, stride);
    } else if (format === 'packed12') {
	unpackedData = unpack12BitData(rawData, width, height, stride, packMode);
    } else if (format === 'unpacked10' || format === 'unpacked12' || format === 'unpacked14' || format === 'unpacked16') {
	unpackedData = bytesToUint16Array(rawData, width, height);
    } else if (format === 'unpacked8') {
	unpackedData = rawData;
    }

    if (subtractOBFlag) {
        unpackedData = subtractOB(unpackedData, obValue);
    }
    
    let rgbData = simpleDemosaic(unpackedData, width, height, pattern, format);
    
    if (applyAWBFlag) {
        rgbData = applyAWB(rgbData, width, height);
    }
    
    return rgbData;
}

function loadSavedValues() {
    const width = localStorage.getItem('width');
    const height = localStorage.getItem('height');
    const stride = localStorage.getItem('stride');
    const subtractOB = localStorage.getItem('subtractOB');
    const obValue = localStorage.getItem('obValue');
    const pattern = localStorage.getItem('bayerPattern');
    const format = localStorage.getItem('bayerFormat');
	const applyAWB = localStorage.getItem('applyAWB');

    if (width) document.getElementById('width').value = width;
    if (height) document.getElementById('height').value = height;
    if (stride) document.getElementById('stride').value = stride;
    const offset = localStorage.getItem('offset');
    if (offset) document.getElementById('offset').value = offset;
    if (subtractOB) document.getElementById('subtractOB').checked = subtractOB === 'true';
    document.getElementById('obValueInput').value = obValue || '0';
    if (pattern) document.querySelector(`input[name="bayerPattern"][value="${pattern}"]`).checked = true;
    if (format) document.querySelector(`input[name="bayerFormat"][value="${format}"]`).checked = true;
	if (applyAWB) document.getElementById('applyAWB').checked = applyAWB === 'true';
    const packMode = localStorage.getItem('packed12Mode');
    if (packMode) {
        const el = document.querySelector(`input[name="packed12Mode"][value="${packMode}"]`);
        if (el) el.checked = true;
    }
    togglePacked12Options();

    const autoStride = localStorage.getItem('autoStride');
    if (autoStride !== null) document.getElementById('autoStride').checked = autoStride === 'true';
    toggleAutoStride();

    toggleOBValueVisibility();
}

function saveValues() {
    const width = document.getElementById('width').value;
    const height = document.getElementById('height').value;
    const stride = document.getElementById('stride').value;
    const subtractOB = document.getElementById('subtractOB').checked;
    const obValue = document.getElementById('obValueInput').value;
    const pattern = document.querySelector('input[name="bayerPattern"]:checked').value;
    const format = document.querySelector('input[name="bayerFormat"]:checked').value;
	const applyAWB = document.getElementById('applyAWB').checked;

    localStorage.setItem('width', width);
    localStorage.setItem('height', height);
    localStorage.setItem('stride', stride);
    localStorage.setItem('offset', document.getElementById('offset').value);
    localStorage.setItem('subtractOB', subtractOB);
    localStorage.setItem('obValue', obValue);
    localStorage.setItem('bayerPattern', pattern);
    localStorage.setItem('bayerFormat', format);
	localStorage.setItem('applyAWB', applyAWB);
	localStorage.setItem('autoStride', document.getElementById('autoStride').checked);
    const packModeEl = document.querySelector('input[name="packed12Mode"]:checked');
    if (packModeEl) localStorage.setItem('packed12Mode', packModeEl.value);
}

function toggleOBValueVisibility() {
    const subtractOB = document.getElementById('subtractOB').checked;
    document.getElementById('obValue').style.display = subtractOB ? 'block' : 'none';
}

function togglePacked12Options() {
    const format = document.querySelector('input[name="bayerFormat"]:checked').value;
    document.getElementById('packed12Options').style.display = format === 'packed12' ? 'block' : 'none';
}

function calculateStride(width, format) {
    switch (format) {
        case 'packed10':
            // 4 pixels per 5 bytes
            return Math.ceil(width / 4) * 5;
        case 'packed12':
            // 2 pixels per 3 bytes
            return Math.ceil(width / 2) * 3;
        case 'unpacked8':
            return width;
        case 'unpacked10':
        case 'unpacked12':
        case 'unpacked14':
        case 'unpacked16':
            return width * 2;
        default:
            return width;
    }
}

function updateAutoStride() {
    if (!document.getElementById('autoStride').checked) return;
    const width = parseInt(document.getElementById('width').value);
    const format = document.querySelector('input[name="bayerFormat"]:checked').value;
    if (width > 0) {
        document.getElementById('stride').value = calculateStride(width, format);
    }
}

function toggleAutoStride() {
    const auto = document.getElementById('autoStride').checked;
    document.getElementById('stride').disabled = auto;
    if (auto) {
        updateAutoStride();
        reprocessImage();
    }
}

function reprocessImage() {
    if (!rawDataBuffer) {
        return;
    }

    const width = parseInt(document.getElementById('width').value);
    const height = parseInt(document.getElementById('height').value);
    const stride = parseInt(document.getElementById('stride').value);
    const pattern = document.querySelector('input[name="bayerPattern"]:checked').value;
    const format = document.querySelector('input[name="bayerFormat"]:checked').value;
    const subtractOBFlag = document.getElementById('subtractOB').checked;
    const obValue = parseInt(document.getElementById('obValueInput').value);
    const applyAWBFlag = document.getElementById('applyAWB').checked;
    const offset = parseInt(document.getElementById('offset').value) || 0;

    if (!width || !height || (!stride && (format === 'packed10' || format === 'packed12'))) {
        alert('Please enter valid width, height, and stride (for packed format) values');
        return;
    }

    // Validate OB value based on bit depth
    let maxOBValue = 1023; // Default for 10-bit
    if (format === 'unpacked12' || format === 'packed12') {
        maxOBValue = 4095; // 12-bit
    } else if (format === 'unpacked14') {
        maxOBValue = 16383; // 14-bit
    } else if (format === 'unpacked16') {
        maxOBValue = 65535; // 16-bit
    } else if (format === 'unpacked8') {
        maxOBValue = 255; // 8-bit
    }

    if (subtractOBFlag && (isNaN(obValue) || obValue < 0 || obValue > maxOBValue)) {
        alert(`Please enter a valid OB value (0-${maxOBValue})`);
        return;
    }

    if (applyAWBFlag && !subtractOBFlag) {
        alert('Subtract OB must be enabled when applying AWB');
        return;
    }

    saveValues();

    const rawData = offset > 0 ? rawDataBuffer.subarray(offset) : rawDataBuffer;
    const packModeEl = document.querySelector('input[name="packed12Mode"]:checked');
    const packMode = packModeEl ? packModeEl.value : 'mipi';
    const imageData = processRawData(rawData, width, height, stride, pattern, subtractOBFlag, obValue, applyAWBFlag, format, packMode);
    drawImage(imageData, width, height);
}

function loadRawImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        rawDataBuffer = new Uint8Array(e.target.result);
        document.getElementById('fileInfo').textContent =
            `File: ${file.name} | Size: ${rawDataBuffer.length} bytes (${(rawDataBuffer.length / 1024).toFixed(1)} KB)`;
        reprocessImage();
    };
    reader.readAsArrayBuffer(file);
}

const imageArea = document.getElementById('imageArea');
const fileInput = document.getElementById('fileInput');

imageArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageArea.classList.add('dragover');
});

imageArea.addEventListener('dragleave', () => {
    imageArea.classList.remove('dragover');
});

imageArea.addEventListener('drop', (e) => {
    e.preventDefault();
    imageArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        loadRawImage(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadRawImage(e.target.files[0]);
    }
});

document.getElementById('subtractOB').addEventListener('change', toggleOBValueVisibility);

document.getElementById('subtractOB').addEventListener('change', () => {
    toggleOBValueVisibility();
    reprocessImage();
});

document.getElementById('width').addEventListener('change', () => {
    updateAutoStride();
    reprocessImage();
});
document.getElementById('height').addEventListener('change', reprocessImage);
document.getElementById('stride').addEventListener('change', reprocessImage);
document.getElementById('offset').addEventListener('change', reprocessImage);
document.getElementById('obValueInput').addEventListener('change', reprocessImage);
document.getElementById('autoStride').addEventListener('change', toggleAutoStride);
document.querySelectorAll('input[name="bayerPattern"]').forEach(radio => {
    radio.addEventListener('change', reprocessImage);
});
document.querySelectorAll('input[name="bayerFormat"]').forEach(radio => {
    radio.addEventListener('change', () => {
        updateAutoStride();
        togglePacked12Options();
        reprocessImage();
    });
});
document.querySelectorAll('input[name="packed12Mode"]').forEach(radio => {
    radio.addEventListener('change', reprocessImage);
});

window.addEventListener('load', loadSavedValues);

// Add zoom functionality
document.getElementById('imageContainer').addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(e.deltaY, e.clientX, e.clientY);
});

// Add pan functionality
document.getElementById('imageCanvas').addEventListener('mousedown', startDrag);

document.getElementById('applyAWB').addEventListener('change', () => {
    if (document.getElementById('applyAWB').checked) {
        document.getElementById('subtractOB').checked = true;
        toggleOBValueVisibility();
    }
    reprocessImage();
});
