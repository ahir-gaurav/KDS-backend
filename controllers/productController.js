const Product = require('../models/Product');
const { cloudinary } = require('../config/cloudinary');
const { computeSellingPrice } = require('../utils/price');

// GET /api/products
const getProducts = async (req, res) => {
    try {
        const { category, sort, page = 1, limit = 12, tag, search } = req.query;
        const query = { isActive: true };

        if (category && category !== 'all') query.category = category;
        if (tag) query.tags = tag;
        if (search) query.$text = { $search: search };

        let sortOption = { createdAt: -1 };
        if (sort === 'price_asc') sortOption = { price: 1 };
        else if (sort === 'price_desc') sortOption = { price: -1 };
        else if (sort === 'newest') sortOption = { createdAt: -1 };
        else if (sort === 'best_selling') sortOption = { soldCount: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Product.countDocuments(query);
        const products = await Product.find(query).sort(sortOption).skip(skip).limit(parseInt(limit));

        res.json({
            products,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/products/best-sellers
const getBestSellers = async (req, res) => {
    try {
        const products = await Product.find({ isActive: true }).sort({ soldCount: -1 }).limit(4);
        res.json({ products });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/products/categories
const getCategories = async (req, res) => {
    try {
        const categories = await Product.distinct('category', { isActive: true });
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/products/:id
const getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        const related = await Product.find({
            category: product.category,
            _id: { $ne: product._id },
            isActive: true,
        }).limit(4);
        res.json({ product, related });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/admin/products (admin)
const createProduct = async (req, res) => {
    try {
        const { name, price, salePrice, category, description, stock, tags, mrp, discountPercent, isOfferActive, offerLabel } = req.body;
        const images = req.files ? req.files.map(f => f.path) : [];

        // Auto-calculate selling price if MRP and discount provided
        const computedSellingPrice = (mrp && discountPercent !== undefined)
            ? computeSellingPrice(mrp, discountPercent)
            : undefined;

        const product = await Product.create({
            name, price, salePrice: salePrice || undefined, category, description, stock: stock || 0,
            images, tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
            mrp: mrp || undefined,
            sellingPrice: computedSellingPrice,
            discountPercent: discountPercent || 0,
            isOfferActive: isOfferActive === 'true' || isOfferActive === true,
            offerLabel: offerLabel || undefined,
        });
        res.status(201).json({ product });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// PUT /api/admin/products/:id (admin)
const updateProduct = async (req, res) => {
    try {
        const { name, price, salePrice, category, description, stock, tags, isActive, existingImages, mrp, discountPercent, isOfferActive, offerLabel } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const newImages = req.files ? req.files.map(f => f.path) : [];
        const oldImages = existingImages ? (Array.isArray(existingImages) ? existingImages : [existingImages]) : [];

        product.name = name || product.name;
        product.price = price || product.price;
        product.salePrice = salePrice || undefined;
        product.category = category || product.category;
        product.description = description || product.description;
        product.stock = stock !== undefined ? stock : product.stock;
        product.tags = tags ? (Array.isArray(tags) ? tags : [tags]) : product.tags;
        product.isActive = isActive !== undefined ? (isActive === 'true' || isActive === true) : product.isActive;
        product.images = [...oldImages, ...newImages];

        // Offer fields
        if (mrp !== undefined) product.mrp = parseFloat(mrp) || product.mrp;
        if (discountPercent !== undefined) product.discountPercent = parseInt(discountPercent) || 0;
        if (isOfferActive !== undefined) product.isOfferActive = isOfferActive === 'true' || isOfferActive === true;
        if (offerLabel !== undefined) product.offerLabel = offerLabel || undefined;
        // Auto-calculate sellingPrice
        if (product.mrp && product.discountPercent !== undefined) {
            product.sellingPrice = computeSellingPrice(product.mrp, product.discountPercent);
        }

        await product.save();
        res.json({ product });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// PATCH /api/admin/products/:id/offer (admin)
const updateProductOffer = async (req, res) => {
    try {
        const { mrp, discountPercent, isOfferActive, offerLabel } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (mrp === undefined || mrp === null) return res.status(400).json({ message: 'MRP is required' });
        if (discountPercent < 0 || discountPercent > 90) return res.status(400).json({ message: 'Discount must be 0-90%' });

        const parsedMrp = parseFloat(mrp);
        const parsedDiscount = parseInt(discountPercent) || 0;
        const computedSellingPrice = computeSellingPrice(parsedMrp, parsedDiscount);

        product.mrp = parsedMrp;
        product.discountPercent = parsedDiscount;
        product.sellingPrice = computedSellingPrice;
        product.isOfferActive = isOfferActive === true || isOfferActive === 'true';
        product.offerLabel = offerLabel || undefined;

        await product.save();
        res.json({ product });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// DELETE /api/admin/products/:id (admin)
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        // Delete images from Cloudinary
        for (const img of product.images) {
            const publicId = img.split('/').slice(-1)[0].split('.')[0];
            await cloudinary.uploader.destroy(`kicks-dont-stink/products/${publicId}`).catch(() => { });
        }

        await product.deleteOne();
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/admin/products/:id/variants (admin)
const addVariant = async (req, res) => {
    try {
        const { size, stock } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const sku = `${product.name.substring(0, 3).toUpperCase().replace(/\s/g, '')}-${size}-${Date.now()}`;
        product.variants.push({ size, stock: stock || 0, sku });
        await product.save();
        res.json({ product });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { getProducts, getBestSellers, getCategories, getProduct, createProduct, updateProduct, deleteProduct, addVariant, updateProductOffer };
