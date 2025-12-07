# Raw Image Viewer

A simple web-based tool for viewing and processing raw Bayer image files in various formats.

[Use it here!](https://benfzc.github.io/Bayer-Raw-Image-Viewer-in-Browser/)

## Features

- Support for multiple bit-depth raw formats (8/10/12/14/16-bit)
- Packed and unpacked format support
- Customizable image dimensions and stride
- Multiple Bayer pattern options (RGGB, BGGR, GRBG, GBRG)
- Simple Optical Black (OB) subtraction and Auto White Balance (AWB)
- Image zoom and pan controls
- Drag-and-drop interface for easy file loading
- In-browser demosaicing and display

## Supported Raw Formats

### Packed Format
- **10-bit packed**: 4 pixels stored in 5 bytes

![packed_raw](https://github.com/user-attachments/assets/692a0ec8-bbb6-47a6-a260-c5f99512b484)

Where A, B, C, and D represent four consecutive 10-bit pixel values.

### Unpacked Formats

Each pixel is stored in 16-bit words (little-endian byte order), with unused high bits set to zero, except for 8-bit format which uses one byte per pixel.

![unpacked_raw](https://github.com/user-attachments/assets/7661830a-10be-43a0-885b-bfeab5ba8895)

- **8-bit**: PIX_FMT_Sxxxx8
- **10-bit**: PIX_FMT_Sxxxx10 (16-bit words, little-endian)
- **12-bit**: PIX_FMT_Sxxxx12 (16-bit words, little-endian)
- **14-bit**: PIX_FMT_Sxxxx14 (16-bit words, little-endian)
- **16-bit**: PIX_FMT_Sxxxx16 (16-bit words, little-endian)

## Usage

1. Open the HTML file in a web browser
2. Enter the image width, height, and stride (bytes per row)
3. Select the Bayer pattern and format
4. (Optional) Enable OB subtraction and/or AWB
5. Drag and drop your raw image file or click to select
6. Use mouse wheel to zoom, click and drag to pan

## Note

This tool is designed for educational and testing purposes. It may not be suitable for processing large image files or for production use.