# Raw Image Viewer

A simple web-based tool for viewing and processing raw Bayer image files in various formats.

[Use it here!](https://benfzc.github.io/Bayer-Raw-Image-Viewer-in-Browser/)

## Features

- Support for multiple bit-depth raw formats (8/10/12/14/16-bit)
- Packed and unpacked format support, including multiple 12-bit packing orders
- Customizable image dimensions, stride (with automatic calculation) and first byte offset
- Multiple Bayer pattern options (RGGB, BGGR, GRBG, GBRG)
- Simple Optical Black (OB) subtraction and Auto White Balance (AWB)
- Image zoom and pan controls
- Drag-and-drop interface for easy file loading
- In-browser demosaicing and display
- Settings are remembered between sessions (browser localStorage)

## Supported Raw Formats

In the diagrams below, A, B, C and D are consecutive pixels, and A0 is the least significant bit of pixel A.

### Packed Formats

**10-bit packed**: 4 pixels stored in 5 bytes, as a continuous LSB-first bit stream
(the same scheme as the 12-bit *Low-first* order).
Note: this is *not* the MIPI CSI-2 RAW10 layout.

```text
10-bit packed
bit        7   6     5   4     3   2     1   0
Byte 0 |  A7  A6    A5  A4    A3  A2    A1  A0 |
Byte 1 |  B5  B4    B3  B2    B1  B0 |  A9  A8 |
Byte 2 |  C3  C2    C1  C0 |  B9  B8    B7  B6 |
Byte 3 |  D1  D0 |  C9  C8    C7  C6    C5  C4 |
Byte 4 |  D9  D8    D7  D6    D5  D4    D3  D2 |
```

**12-bit packed**: 2 pixels stored in 3 bytes. Select the packing order that matches your data:

```text
MIPI CSI-2 (default) - V4L2_PIX_FMT_Sxxxx12P
bit        7   6   5   4     3   2   1   0
Byte 0 | A11 A10  A9  A8    A7  A6  A5  A4 |
Byte 1 | B11 B10  B9  B8    B7  B6  B5  B4 |
Byte 2 |  B3  B2  B1  B0 |  A3  A2  A1  A0 |

Low bytes first, high nibbles in 3rd byte
bit        7   6   5   4     3   2   1   0
Byte 0 |  A7  A6  A5  A4    A3  A2  A1  A0 |
Byte 1 |  B7  B6  B5  B4    B3  B2  B1  B0 |
Byte 2 | B11 B10  B9  B8 | A11 A10  A9  A8 |

High-first (sequential)
bit        7   6   5   4     3   2   1   0
Byte 0 | A11 A10  A9  A8    A7  A6  A5  A4 |
Byte 1 |  A3  A2  A1  A0 | B11 B10  B9  B8 |
Byte 2 |  B7  B6  B5  B4    B3  B2  B1  B0 |

Low-first (sequential)
bit        7   6   5   4     3   2   1   0
Byte 0 |  A7  A6  A5  A4    A3  A2  A1  A0 |
Byte 1 |  B3  B2  B1  B0 | A11 A10  A9  A8 |
Byte 2 | B11 B10  B9  B8    B7  B6  B5  B4 |
```

### Unpacked Formats

Each pixel is stored in a 16-bit word (little-endian byte order), with unused high bits set to zero, except for 8-bit format which uses one byte per pixel.

```text
10-bit in 16-bit word (PIX_FMT_Sxxxx10)
bit        7   6   5   4   3   2   1   0
Byte 0 |  A7  A6  A5  A4  A3  A2  A1  A0 |
Byte 1 |   0   0   0   0   0   0  A9  A8 |
Byte 2 |  B7  B6  B5  B4  B3  B2  B1  B0 |
Byte 3 |   0   0   0   0   0   0  B9  B8 |
```

12-bit and 14-bit formats follow the same rule, with more bits used in the high byte.

- **8-bit**: PIX_FMT_Sxxxx8
- **10-bit**: PIX_FMT_Sxxxx10 (16-bit words, little-endian)
- **12-bit**: PIX_FMT_Sxxxx12 (16-bit words, little-endian)
- **14-bit**: PIX_FMT_Sxxxx14 (16-bit words, little-endian)
- **16-bit**: PIX_FMT_Sxxxx16 (16-bit words, little-endian)

## Usage

1. Open the HTML file in a web browser
2. Enter the image width and height
3. Select the Bayer pattern and format (for 12-bit packed, also select the packing order)
4. Stride is calculated automatically for tightly packed data. Uncheck **Auto** to enter it manually if your rows are padded (e.g. aligned to 16/32/64 bytes)
5. (Optional) Set **First byte offset** to skip a file header
6. (Optional) Enable OB subtraction and/or AWB (AWB requires OB subtraction)
7. Drag and drop your raw image file or click to select
8. Use mouse wheel to zoom, click and drag to pan
