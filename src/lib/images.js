/** Longest side, in px, of an uploaded image after downscaling. */
export const MAX_EDGE = 1920;

/**
 * Shrinks big photos (phones easily give 4000px / 8 MB) to `maxEdge` as WebP.
 * GIFs are kept as-is (animation), and the original is used whenever the
 * re-encode isn't smaller or the browser can't decode it.
 * @param {File} file
 * @param {number} [maxEdge]
 * @returns {Promise<Blob>}
 */
export async function downscale(file, maxEdge = MAX_EDGE) {
    if (file.type === "image/gif") return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        /** @type {Blob | null} */
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
        return blob && blob.size < file.size ? blob : file;
    } catch {
        return file;
    }
}
