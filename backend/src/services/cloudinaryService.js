const cloudinary = require('cloudinary').v2;

let isConfigured = false;

/**
 * Configure Cloudinary with environment variables
 */
const initCloudinary = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn('⚠️ Cloudinary credentials missing in .env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)');
    return false;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  isConfigured = true;
  return true;
};

// Initialise on load
initCloudinary();

/**
 * Upload a file buffer to Cloudinary using upload_stream.
 * Supports both images and PDFs (resource_type: 'auto').
 *
 * @param {Buffer} buffer - File buffer
 * @param {Object} [options={}] - Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload result containing secure_url
 */
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isConfigured && !initCloudinary()) {
      return reject(new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env'));
    }

    const defaultOptions = {
      folder: 'calorie-tracker/uploads',
      resource_type: 'auto', // Automatically detects image vs raw/pdf
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(defaultOptions, (error, result) => {
      if (error) {
        return reject(new Error(`Cloudinary upload failed: ${error.message}`));
      }
      resolve(result);
    });

    stream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary.
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {string} [resourceType='image'] - 'image' | 'raw'
 * @returns {Promise<Object>}
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!isConfigured && !initCloudinary()) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  isCloudinaryConfigured: () => isConfigured || initCloudinary(),
};
