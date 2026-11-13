import { imageSize } from "image-size";
import { createCanvas, loadImage } from "@napi-rs/canvas";
export function validateImage(bytes: Buffer) {
  const size = imageSize(bytes);
  if (
    !size.width ||
    !size.height ||
    size.width * size.height > 40000000 ||
    !["png", "jpg", "webp"].includes(size.type ?? "")
  )
    throw Error("Neplatný obrázok alebo prekročený limit 40 miliónov pixelov.");
  return size;
}
export async function imageCanvas(
  bytes: Buffer,
  maxWidth?: number,
  maxHeight?: number,
) {
  validateImage(bytes);
  const image = await loadImage(bytes);
  const scale =
    maxWidth && maxHeight
      ? Math.min(1, maxWidth / image.width, maxHeight / image.height)
      : 1;
  const canvas = createCanvas(
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  );
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
