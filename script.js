// --- JavaScript Code ---
const canvas = document.getElementById('mandelbrotCanvas');
const ctx = canvas.getContext('2d');
const zoomLevelDisplay = document.getElementById('zoomLevel');
const iterationsInput = document.getElementById('iterations');
// meh je sais pas se que je fout la...
const HIGH_ZOOM_THRESHOLD = 1e6;
const EXTREME_ZOOM_THRESHOLD = 1e12;
let isRendering = false;
const PIXEL_SIZE_THRESHOLD = 1e-10;

// Set initial canvas dimensions
let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// Initial Mandelbrot view area
let xMin = -2.5;
let xMax = 1.0;
let yMin = -1.5;
let yMax = 1.5;

let maxIterations = 100;
const zoomFactor = 2;
let zoomLevel = 1;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let lastImage = null;

// Variables for progressive rendering
let renderTimeout = null;
let currentRenderId = 0;

function getPixelSize() {
    const xPixelSize = (xMax - xMin) / canvas.width;
    const yPixelSize = (yMax - yMin) / canvas.height;
    return { x: xPixelSize, y: yPixelSize };
}

/**
 * Draws the Mandelbrot set on the canvas.
 * @param {number} iterations The number of iterations to use for this draw.
 */
async function drawMandelbrot(iterations) {
    if (isRendering) return;
    isRendering = true;
    
    const renderId = ++currentRenderId;
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;

    // Vérifier et ajuster la taille des pixels si nécessaire
    const pixelSize = getPixelSize();
    let adjustedWidth = currentWidth;
    let adjustedHeight = currentHeight;
    
    if (zoomLevel > PIXEL_SIZE_THRESHOLD) {
        const ratio = pixelSize.x / pixelSize.y;
        if (ratio > 1.1 || ratio < 0.9) {
            if (ratio > 1) {
                adjustedWidth = Math.ceil(currentWidth * ratio);
            } else {
                adjustedHeight = Math.ceil(currentHeight / ratio);
            }
        }
    }

    // Créer un canvas temporaire
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = adjustedWidth;
    tempCanvas.height = adjustedHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Afficher l'ancienne image en fond
    if (lastImage) {
        ctx.putImageData(lastImage, 0, 0);
    }

    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    // Mode de rendu selon le niveau de zoom
    if (zoomLevel < HIGH_ZOOM_THRESHOLD) {
        // Mode rapide pour les zooms faibles
        const imageData = tempCtx.createImageData(adjustedWidth, adjustedHeight);
        const data = imageData.data;

        for (let x = 0; x < adjustedWidth; x++) {
            for (let y = 0; y < adjustedHeight; y++) {
                if (renderId !== currentRenderId) {
                    isRendering = false;
                    return;
                }

                const cx = xMin + (x / adjustedWidth) * xRange;
                const cy = yMin + (y / adjustedHeight) * yRange;

                let zx = 0;
                let zy = 0;
                let i = 0;
                
                while (zx * zx + zy * zy < 4 && i < iterations) {
                    const tmp = zx * zx - zy * zy + cx;
                    zy = 2 * zx * zy + cy;
                    zx = tmp;
                    i++;
                }

                 let r, g, b;
                  if (i === iterations) {
                  // Point dans l'ensemble = noir
                  r = g = b = 0;
                 } else {
                  // Point hors de l'ensemble = couleur selon le nombre d'itérations
                 const hue = (i / iterations) * 360;
                 [r, g, b] = HSLToRGB(hue, 100, 50);
                }

                const idx = 4 * (y * adjustedWidth + x);
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }

            if (x % 50 === 0) {
                tempCtx.putImageData(imageData, 0, 0);
                ctx.globalAlpha = 0.5;
                ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
                ctx.globalAlpha = 1.0;
                await new Promise(res => setTimeout(res, 0));
            }
        }
        tempCtx.putImageData(imageData, 0, 0);
    } else {
        // Mode haute précision pour les zooms élevés
        const useDecimal = zoomLevel >= EXTREME_ZOOM_THRESHOLD;
        
        for (let x = 0; x < adjustedWidth; x++) {
            for (let y = 0; y < adjustedHeight; y++) {
                if (renderId !== currentRenderId) {
                    isRendering = false;
                    return;
                }

                let cx, cy, zx, zy;
                if (useDecimal) {
                    cx = new Decimal(xMin).plus(new Decimal(x).div(adjustedWidth).times(xRange));
                    cy = new Decimal(yMin).plus(new Decimal(y).div(adjustedHeight).times(yRange));
                    zx = new Decimal(0);
                    zy = new Decimal(0);
                } else {
                    cx = xMin + (x / adjustedWidth) * xRange;
                    cy = yMin + (y / adjustedHeight) * yRange;
                    zx = 0;
                    zy = 0;
                }

                let i = 0;
                if (useDecimal) {
                    while (i < iterations) {
                        const zx2 = zx.times(zx);
                        const zy2 = zy.times(zy);
                        if (zx2.plus(zy2).gt(4)) break;
                        
                        const newZx = zx2.minus(zy2).plus(cx);
                        zy = zx.times(zy).times(2).plus(cy);
                        zx = newZx;
                        i++;
                    }
                } else {
                    while (i < iterations) {
                        const zx2 = zx * zx;
                        const zy2 = zy * zy;
                        if (zx2 + zy2 > 4) break;
                        
                        const newZx = zx2 - zy2 + cx;
                        zy = 2 * zx * zy + cy;
                        zx = newZx;
                        i++;
                    }
                }

                let r, g, b;
                if (i === iterations) {
                    r = g = b = 0;
                } else {
                    const hue = (i / iterations) * 360;
                    [r, g, b] = HSLToRGB(hue, 100, 50);
                }

                tempCtx.fillStyle = `rgb(${r},${g},${b})`;
                tempCtx.fillRect(x, y, 1, 1);
            }

            if (x % 20 === 0) {
                ctx.globalAlpha = 0.5;
                ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
                ctx.globalAlpha = 1.0;
                await new Promise(res => setTimeout(res, 0));
            }
        }
    }

    // Affichage final
    ctx.globalAlpha = 1.0;
    ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
    
    isRendering = false;
    lastImage = ctx.getImageData(0, 0, currentWidth, currentHeight);
}
/**
 * Converts HSL to RGB color values.
 * @param {number} h Hue
 * @param {number} s Saturation
 * @param {number} l Lightness
 * @returns {number[]} RGB array
 */
function HSLToRGB(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return [r, g, b];
}

/**
 * Handles the main drawing logic, ensuring the old image stays visible during calculation.
 */
function progressiveDraw() {
    // Clear any previous timeouts to prevent race conditions
    if (renderTimeout) {
        clearTimeout(renderTimeout);
    }
    
    // We don't draw a low-quality version anymore.
    // The previous image is already visually transformed.
    
    // Start the high-quality render asynchronously
    renderTimeout = setTimeout(() => {
        drawMandelbrot(maxIterations);
    }, 50); // Small delay to allow visual transformation to happen
}

// Handle mouse click for zooming
canvas.addEventListener('click', (event) => {
    if (event.button === 2) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const xRange = xMax - xMin;

    const xClick = xMin + (mouseX / canvas.width) * xRange;
    const yClick = yMin + (mouseY / canvas.height) * (yMax - yMin);
    
    let newXRange;

    if (event.shiftKey) {
        newXRange = xRange * zoomFactor;
        zoomLevel /= zoomFactor;
        maxIterations = Math.max(10, maxIterations - 20);
    } else {
        newXRange = xRange / zoomFactor;
        zoomLevel *= zoomFactor;
        maxIterations += 20;
    }
    
    // Visually zoom the old image immediately
    const scale = xRange / newXRange;
    const tx = -mouseX * (scale - 1);
    const ty = -mouseY * (scale - 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (lastImage) {
        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(tx / scale, ty / scale);
        ctx.putImageData(lastImage, 0, 0);
        ctx.restore();
    }
    
    // Update the Mandelbrot view area for the new calculation
    xMin = xClick - newXRange / 2;
    xMax = xClick + newXRange / 2;
    yMin = yClick - (newXRange / (canvas.width / canvas.height)) / 2;
    yMax = yClick + (newXRange / (canvas.width / canvas.height)) / 2;

    zoomLevelDisplay.textContent = Math.round(zoomLevel * 100) / 100;
    iterationsInput.value = maxIterations;

    progressiveDraw();
});

// Handle mouse wheel for zooming
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const xRange = xMax - xMin;
    
    let newXRange;

    if (event.deltaY < 0) {
        newXRange = xRange / zoomFactor;
        zoomLevel *= zoomFactor;
        maxIterations += 20;
    } else {
        newXRange = xRange * zoomFactor;
        zoomLevel /= zoomFactor;
        maxIterations = Math.max(10, maxIterations - 20);
    }
    
    // Visually zoom the old image immediately
    const scale = xRange / newXRange;
    const tx = -mouseX * (scale - 1);
    const ty = -mouseY * (scale - 1);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (lastImage) {
        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(tx / scale, ty / scale);
        ctx.putImageData(lastImage, 0, 0);
        ctx.restore();
    }
    
    const xCenter = xMin + xRange / 2;
    const yCenter = yMin + (yMax - yMin) / 2;

    xMin = xCenter - newXRange / 2;
    xMax = xCenter + newXRange / 2;
    yMin = yCenter - (newXRange / (canvas.width / canvas.height)) / 2;
    yMax = yCenter + (newXRange / (canvas.width / canvas.height)) / 2;
    
    zoomLevelDisplay.textContent = Math.round(zoomLevel * 100) / 100;
    iterationsInput.value = maxIterations;
    progressiveDraw();
});

// Handle right-click for dragging
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

canvas.addEventListener('mousedown', (event) => {
    if (event.button === 2) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        dragStartX = event.clientX;
        dragStartY = event.clientY;
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
        // Cancel any pending render to avoid race conditions
        if (renderTimeout) {
            clearTimeout(renderTimeout);
        }
        
        // Calculate the distance of the drag
        const dragOffsetX = event.clientX - dragStartX;
        const dragOffsetY = event.clientY - dragStartY;

        // Visually shift the canvas content for a fluid drag
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (lastImage) {
            ctx.putImageData(lastImage, dragOffsetX, dragOffsetY);
        }
    }
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button === 2 && isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';

        // Translate the Mandelbrot view based on the drag distance
        const dragOffsetX = event.clientX - dragStartX;
        const dragOffsetY = event.clientY - dragStartY;
        
        const xRange = xMax - xMin;
        const yRange = yMax - yMin;
        xMin -= (dragOffsetX / canvas.width) * xRange;
        xMax -= (dragOffsetX / canvas.width) * xRange;
        yMin -= (dragOffsetY / canvas.height) * yRange;
        yMax -= (dragOffsetY / canvas.height) * yRange;

        // Trigger a high-quality render once the user stops dragging
        progressiveDraw();
    }
});

// Iterations control
iterationsInput.addEventListener('change', (event) => {
    const newIterations = parseInt(event.target.value);
    
    if (!isNaN(newIterations) && newIterations >= 10) {
        maxIterations = newIterations;
        progressiveDraw();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    const xRange = xMax - xMin;
    const yRange = (xRange / width) * height;
    const yCenter = (yMin + yMax) / 2;
    yMin = yCenter - (yRange / 2);
    yMax = yCenter + (yRange / 2);

    progressiveDraw();
});

// Initial draw of the Mandelbrot set
progressiveDraw();
