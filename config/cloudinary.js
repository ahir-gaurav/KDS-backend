const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'kicks-dont-stink/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
    },
});

const heroStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'kicks-dont-stink/hero',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }],
    },
});

const uploadProduct = multer({ storage: productStorage });
const uploadHero = multer({ storage: heroStorage });

module.exports = { cloudinary, uploadProduct, uploadHero };
