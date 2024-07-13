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

function simpleDemosaic(bayerData, width, height, pattern) {
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
                if ((y % 2 === redOffset[1]) !== (x % 2 === redOffset[0])) {
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
            rgbData[outIndex] = r >> 2;     // Convert 10-bit to 8-bit
            rgbData[outIndex + 1] = g >> 2;
            rgbData[outIndex + 2] = b >> 2;
            rgbData[outIndex + 3] = 255;    // Alpha channel
        }
    }
    
    return rgbData;
}

function processRawData(rawData, width, height, stride, pattern) {
    const unpackedData = unpack10BitData(rawData, width, height, stride);
    return simpleDemosaic(unpackedData, width, height, pattern);
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
}

function loadRawImage(file) {
    const width = parseInt(document.getElementById('width').value);
    const height = parseInt(document.getElementById('height').value);
    const stride = parseInt(document.getElementById('stride').value);
    const pattern = document.querySelector('input[name="bayerPattern"]:checked').value;

    if (!width || !height || !stride) {
        alert('Please enter valid width, height, and stride values');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const rawData = new Uint8Array(e.target.result);
        const imageData = processRawData(rawData, width, height, stride, pattern);
        drawImage(imageData, width, height);
    };
    reader.readAsArrayBuffer(file);
}

const imageArea = document.getElementById('imageArea');
const fileInput = document.getElementById('fileInput');

imageArea.addEventListener('click', () => fileInput.click());

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