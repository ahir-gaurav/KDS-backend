// backend/services/productService.js
'use strict';

const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { PAGINATION } = require('../config/constants');

/**
 * Get paginated product list with filters and sorting.
 */
const getProducts = async (query) => {
    const page  = Math.max(1, parseInt(query.page)  || PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(
        parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT,
        PAGINATION.MAX_LIMIT
    );
    const offset = (page - 1) * limit;

    let sbQuery = supabase
        .from('products')
        .select('*, category:categories(name, slug)', { count: 'exact' })
        .eq('is_active', true);

    // Filters
    if (query.category) sbQuery = sbQuery.eq('category_id', query.category);
    if (query.brand)    sbQuery = sbQuery.ilike('brand', `%${query.brand}%`);
    if (query.tag)      sbQuery = sbQuery.contains('tags', [query.tag]);
    if (query.featured === 'true') sbQuery = sbQuery.eq('is_featured', true);

    // Price range
    if (query.minPrice) sbQuery = sbQuery.gte('price', Number(query.minPrice));
    if (query.maxPrice) sbQuery = sbQuery.lte('price', Number(query.maxPrice));

    // Sorting
    const sortParam = query.sort || 'newest';
    switch (sortParam) {
        case 'price_asc':
            sbQuery = sbQuery.order('price', { ascending: true });
            break;
        case 'price_desc':
            sbQuery = sbQuery.order('price', { ascending: false });
            break;
        case 'popular':
            sbQuery = sbQuery.order('sold_count', { ascending: false });
            break;
        case 'rating':
            sbQuery = sbQuery.order('ratings->average', { ascending: false });
            break;
        case 'newest':
        default:
            sbQuery = sbQuery.order('created_at', { ascending: false });
            break;
    }

    const { data: products, count, error } = await sbQuery
        .range(offset, offset + limit - 1);

    if (error) throw new AppError('Error fetching products.', 500);

    return {
        products,
        pagination: {
            total: count,
            page,
            limit,
            pages: Math.ceil(count / limit),
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
    const offset   = (pageNum - 1) * limitNum;

    // Simple search using ILIKE for title/brand/description
    const { data: products, count, error } = await supabase
        .from('products')
        .select('*, category:categories(name, slug)', { count: 'exact' })
        .eq('is_active', true)
        .or(`title.ilike.%${q}%,brand.ilike.%${q}%,description.ilike.%${q}%`)
        .range(offset, offset + limitNum - 1)
        .order('created_at', { ascending: false });

    if (error) throw new AppError('Error searching products.', 500);

    return {
        products,
        pagination: { total: count, page: pageNum, limit: limitNum, pages: Math.ceil(count / limitNum) },
    };
};

/**
 * Get a single product by ID or slug.
 */
const getProductByIdOrSlug = async (identifier) => {
    // Check if UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const column = isUuid ? 'id' : 'slug';

    const { data: product, error } = await supabase
        .from('products')
        .select('*, category:categories(name, slug), reviews(id, rating, comment, images, created_at, user:users(name, avatar))')
        .eq(column, identifier)
        .eq('is_active', true)
        .single();

    if (error || !product) throw new AppError('Product not found.', 404);
    return product;
};

/**
 * Create a new product.
 */
const createProduct = async (data) => {
    // Slugify title if not provided (handled by trigger in SQL usually, but let's be explicit if needed)
    // For now, assume data has what we need or add slug logic here if required.
    const { data: product, error } = await supabase
        .from('products')
        .insert(data)
        .select()
        .single();

    if (error) throw new AppError(error.message, 400);
    return product;
};

/**
 * Update product by ID.
 */
const updateProduct = async (id, data) => {
    const { data: product, error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error || !product) throw new AppError('Product not found or update failed.', 404);
    return product;
};

/**
 * Soft-delete (deactivate) a product.
 */
const deleteProduct = async (id) => {
    const { data: product, error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

    if (error || !product) throw new AppError('Product not found.', 404);
    return product;
};

/**
 * Get featured products.
 */
const getFeaturedProducts = async (limit = 8) => {
    const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(name, slug)')
        .eq('is_featured', true)
        .eq('is_active', true)
        .order('sold_count', { ascending: false })
        .limit(limit);

    if (error) throw new AppError('Error fetching featured products.', 500);
    return data;
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
