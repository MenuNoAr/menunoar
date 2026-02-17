
/**
 * Image and File Upload Utilities
 * Handles intelligent WebP conversion and Supabase storage uploads.
 */
let supabaseInstance = null;

/**
 * Initialize the upload service with a Supabase client instance.
 * @param {object} supabaseClient - The initialized Supabase client.
 */
export function initUploadService(supabaseClient) {
    supabaseInstance = supabaseClient;
}

/**
 * Uploads a file to Supabase Storage.
 * If the file is an image, it attempts to convert it to high-quality WebP first.
 * If conversion fails or file is not an image, it uploads the original file.
 * 
 * @param {File} file - The file object to upload.
 * @param {string} namePrefix - Prefix for the filename (e.g., 'cover', 'item-123').
 * @param {string} bucket - The storage bucket name (default: 'menu-assets').
 * @returns {Promise<{data: object|null, error: object|null}>} - Result with public URL data or error.
 */
export async function uploadFile(file, namePrefix, bucket = 'menu-assets') {
    if (!supabaseInstance) {
        console.error("Upload Service not initialized! Call initUploadService first.");
        return { error: { message: "Service not initialized" } };
    }

    let fileToUpload = file;
    let fileExt = file.name.split('.').pop().toLowerCase();

    // Check if image and convert to WebP
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        try {
            console.log("Optimizing image...", file.name);
            const webpBlob = await convertToWebP(file);
            if (webpBlob) {
                fileToUpload = webpBlob;
                fileExt = 'webp';
                console.log("Image converted to WebP successfully.");
            }
        } catch (err) {
            console.warn("WebP conversion failed, using original file.", err);
        }
    }

    const fileName = `${namePrefix}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabaseInstance.storage
        .from(bucket)
        .upload(fileName, fileToUpload, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        return { error };
    }

    const { data: publicUrlData } = supabaseInstance.storage
        .from(bucket)
        .getPublicUrl(fileName);

    return { data: { publicUrl: publicUrlData.publicUrl } };
}

/**
 * Converts an image file to a WebP Blob using the Canvas API.
 * Uses high quality (0.90) to ensure "intelligent lossless-like" quality.
 * 
 * @param {File} file - The original image file.
 * @returns {Promise<Blob>} - The WebP blob.
 */
function convertToWebP(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Create canvas
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Optional: Max dimension constraint (e.g. 2500px) to prevent massive uploads
            // For now, keeping original dimensions for quality preservation unless huge
            const MAX_DIM = 2500;
            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height = Math.round((height * MAX_DIM) / width);
                    width = MAX_DIM;
                } else {
                    width = Math.round((width * MAX_DIM) / height);
                    height = MAX_DIM;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to WebP
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Canvas toBlob failed"));
                }
            }, 'image/webp', 0.90); // 0.90 quality is very high, close to visual lossless but much smaller
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
}
