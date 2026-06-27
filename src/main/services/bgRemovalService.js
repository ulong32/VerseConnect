import { AutoModel, AutoProcessor, RawImage, env } from "@huggingface/transformers";

// Configure transformers environment if needed
env.allowLocalModels = true;

/** @type {Record<string, { id: string, options?: any }>} */
const AI_MODELS = {
  rmbg: {
    id: "briaai/RMBG-1.4",
    options: { config: /** @type {any} */ ({ model_type: "custom" }) },
  },
  modnet: { id: "Xenova/modnet", options: undefined },
};

/** @type {Record<string, any>} */
const loadedModels = {};
/** @type {Record<string, any>} */
const loadedProcessors = {};
/** @type {Record<string, Promise<void>>} */
const loadingPromises = {};

/**
 * @param {string} algo
 */
async function loadModel(algo) {
  const modelInfo = AI_MODELS[algo];
  if (!modelInfo) throw new Error("Unknown AI model");

  console.log(`Loading ${modelInfo.id} model...`);
  loadedModels[algo] = await AutoModel.from_pretrained(modelInfo.id, modelInfo.options);
  loadedProcessors[algo] = await AutoProcessor.from_pretrained(modelInfo.id);
  console.log(`${modelInfo.id} model loaded.`);
}

/**
 * RendererのCanvasから送られたImageDataを元にアルファマスクを生成して返す
 * @param {{ data: Uint8Array, width: number, height: number }} imageData
 * @param {string} [algorithm="rmbg"]
 * @returns {Promise<Uint8Array>} maskData (1 channel grayscale)
 */
export async function getBackgroundMask(imageData, algorithm = "rmbg") {
  try {
    if (algorithm === "floodfill") {
      return runFloodFill(imageData);
    }

    // Default to rmbg if invalid algorithm is passed (but not floodfill)
    if (!AI_MODELS[algorithm]) {
      algorithm = "rmbg";
    }

    if (!loadedModels[algorithm] || !loadedProcessors[algorithm]) {
      if (!loadingPromises[algorithm]) {
        loadingPromises[algorithm] = loadModel(algorithm);
      }
      await loadingPromises[algorithm];
    }

    const model = loadedModels[algorithm];
    const processor = loadedProcessors[algorithm];

    // RawImage expects Uint8Array or Uint8ClampedArray
    // ImageData from canvas is RGBA (4 channels)
    const image = new RawImage(imageData.data, imageData.width, imageData.height, 4);

    // Preprocess image
    const { pixel_values } = await processor(image);

    // Predict alpha matte
    const result = await model({ input: pixel_values });
    // Handle different output tensor keys (e.g., 'output' for both RMBG and modnet, but fallback just in case)
    const outputTensor = result.output || Object.values(result)[0];

    // The output is a tensor of shape [1, 1, H, W] with values in [0, 1].
    // Resize mask back to original image size
    const mask = await RawImage.fromTensor(outputTensor[0].mul(255).to("uint8")).resize(
      imageData.width,
      imageData.height,
    );

    return new Uint8Array(mask.data);
  } catch (error) {
    console.error("Error generating background mask:", error);
    throw error;
  }
}

/**
 * @param {{ data: Uint8Array|Uint8ClampedArray, width: number, height: number, seedPoints?: {x: number, y: number}[], tolerance?: number }} imageData
 * @returns {Uint8Array}
 */
function runFloodFill(imageData) {
  const { data, width, height, seedPoints = [], tolerance = 30 } = imageData;
  const mask = new Uint8Array(width * height);
  mask.fill(255); // Initialize all as foreground (opaque)

  // Target background color is fixed to FFFFFF
  const targetR = 255;
  const targetG = 255;
  const targetB = 255;

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  const isBackground = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const i = (y * width + x) * 4;

    // Check color distance with tolerance for JPEG noise
    const diffR = Math.abs(targetR - data[i]);
    const diffG = Math.abs(targetG - data[i + 1]);
    const diffB = Math.abs(targetB - data[i + 2]);

    return diffR <= tolerance && diffG <= tolerance && diffB <= tolerance;
  };

  const queue = [];

  // Start from 4 corners
  const startCorners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  for (const [x, y] of startCorners) {
    if (isBackground(x, y)) queue.push([x, y]);
  }

  // Add user defined seed points (Magic Wand)
  for (const pt of seedPoints) {
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    if (x >= 0 && x < width && y >= 0 && y < height) {
      queue.push([x, y]);
    }
  }

  const visited = new Uint8Array(width * height);

  for (const [startX, startY] of queue) {
    const startIdx = startY * width + startX;
    if (visited[startIdx]) continue;

    const q = [[startX, startY]];
    visited[startIdx] = 1;
    mask[startIdx] = 0; // set as background (transparent)

    let head = 0;
    while (head < q.length) {
      const [cx, cy] = q[head++];

      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && isBackground(nx, ny)) {
            visited[nIdx] = 1;
            mask[nIdx] = 0;
            q.push([nx, ny]);
          }
        }
      }
    }
  }

  // Anti-aliasing (simple 3x3 box blur on boundaries)
  const smoothedMask = new Uint8Array(mask);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Only process pixels that are at the edge between foreground and background
      if (
        mask[idx] !== mask[idx - 1] ||
        mask[idx] !== mask[idx + 1] ||
        mask[idx] !== mask[idx - width] ||
        mask[idx] !== mask[idx + width]
      ) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += mask[(y + dy) * width + (x + dx)];
          }
        }
        smoothedMask[idx] = sum / 9;
      }
    }
  }

  return smoothedMask;
}
