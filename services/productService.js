// backend/services/productService.js
'use strict';

const Product  = require('../models/Product');
const AppError = require('../utils/AppError');
const { PAGINATION } = require('../config/constants');

/**
 * Build a MongoDB filter query from request query params.
 */
const buildFilter = (query) => {
    const filter = { isActive: true };

    if (query.category) filter.category = query.category;
    if (query.brand)    filter.brand = new RegExp(query.brand, 'i');
    if (query.tag)      filter.tags = query.tag;
    if (query.featured === 'true') filter.isFeatured = true;

    // Price range
    if (query.minPrice || query.maxPrice) {
        filter.price = {};
        if (query.minPrice) filter.price.$gte = Number(query.minPrice);
        if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
    }

    return filter;
};

/**
 * Build sort object from query param.
 * Supported: price_asc, price_desc, newest, popular, rating
 */
const buildSort = (sortParam) => {
    const sorts = {
        price_asc:  { price:     1 },
        price_desc: { price:    -1 },
        newest:     { createdAt: -1 },
        popular:    { soldCount: -1 },
        rating:     { 'ratings.average': -1 },
    };
    return sorts[sortParam] || { createdAt: -1 };
};

/**
 * Get paginated product list with filters and sorting.
 */
const getProducts = async (query) => {
    const page  = Math.max(1, parseInt(query.page)  || PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(
        parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT,
        PAGINATION.MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    const filter = buildFilter(query);
    const sort   = buildSort(query.sort);

    const [products, total] = await Promise.all([
        Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('category', 'name slug'),
        Product.countDocuments(filter),
    ]);

    return {
        products,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };
};

/**
 * Full-text search with pagination.
 */
const searchProducts = async (query) => {
    const { q, page = 1, limit = PAGINATION.DEFAULT_LIMIT } = query;
    if (!q?.trim()) throw new AppError('Search query is required.', 400);

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
    const skip     = (pageNum - 1) * limitNum;

    const filter = {
        isActive: true,
        $text: { $search: q },
    };

    const [products, total] = await Promise.all([
        Product.find(filter, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name slug'),
        Product.countDocuments(filter),
    ]);

    return {
        products,
        pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    };
};

/**
 * Get a single product by ID or slug.
 */
const getProductByIdOrSlug = async (identifier) => {
    const isId   = identifier.match(/^[a-f\d]{24}$/i);
    const query  = isId ? { _id: identifier } : { slug: identifier };
    const product = await Product.findOne({ ...query, isActive: true })
        .populate('category', 'name slug')
        .populate({ path: 'reviews', select: 'user rating comment verified createdAt', options: { limit: 20 } });

    if (!product) throw new AppError('Product not found.', 404);
    return product;
};

/**
 * Create a new product.
 */
const createProduct = async (data) => {
    const product = await Product.create(data);
    return product;
};

/**
 * Update product by ID.
 */
const updateProduct = async (id, data) => {
    const product = await Product.findByIdAndUpdate(id, data, {
        new:              true,
        runValidators:    true,
    });
    if (!product) throw new AppError('Product not found.', 404);
    return product;
};

/**
 * Soft-delete (deactivate) a product.
 */
const deleteProduct = async (id) => {
    const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!product) throw new AppError('Product not found.', 404);
    return product;
};

/**
 * Get featured products.
 */
const getFeaturedProducts = async (limit = 8) => {
    return Product.find({ isFeatured: true, isActive: true })
        .sort({ soldCount: -1 })
        .limit(limit)
        .populate('category', 'name slug');
};

module.exports = {
    getProducts,
    searchProducts,
    getProductByIdOrSlug,
    createProduct,
    updateProduct,
    deleteProduct,
    getFeaturedProducts,
};
