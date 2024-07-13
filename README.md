# Raw Image Viewer

A simple web-based tool for viewing and processing packed raw image files.

## Features

- Support for 10-bit packed raw image format
- Customizable image dimensions and stride
- Multiple Bayer pattern options (RGGB, BGGR, GRBG, GBRG)
- Drag-and-drop interface for easy file loading
- In-browser demosaicing and display

## Supported Raw Format

This viewer supports a specific 10-bit packed raw format where 4 pixels are stored in 5 bytes:

![packed_raw](https://github.com/user-attachments/assets/692a0ec8-bbb6-47a6-a260-c5f99512b484)

Where A, B, C, and D represent four consecutive 10-bit pixel values.

## Usage

1. Open the HTML file in a web browser
2. Enter the image width, height, and stride (bytes per row)
3. Select the appropriate Bayer pattern
4. Drag and drop your raw image file onto the designated area or click to select a file
5. The processed image will be displayed in the viewer

## Note

This tool is designed for educational and testing purposes. It may not be suitable for processing large image files or for production use.