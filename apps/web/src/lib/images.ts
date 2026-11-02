// Pictures go to the public "site-media" storage bucket. Phone photos are often several
// megabytes, so they are shrunk in the browser before upload.

export const MEDIA_BUCKET = "site-media";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_DIMENSION = 1600;

/** Returns a message if the file is not an acceptable picture, otherwise null. */
export function checkImageFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Please choose a JPG, PNG or WebP picture.";
  }
  return null;
}

export function newImagePath(folder: string, extension = "jpg"): string {
  return `${folder}/${crypto.randomUUID()}.${extension}`;
}

/** Scales the picture down to at most 1600 pixels on its longest side, as a JPEG. */
export async function shrinkImage(file: File): Promise<Blob> {
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare the picture.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("The picture could not be prepared.");
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("That picture is still too large. Try a smaller one.");
  }
  return blob;
}
