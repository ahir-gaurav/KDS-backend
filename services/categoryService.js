// backend/services/categoryService.js
'use strict';

const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');

const getCategories = async () => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) throw new AppError('Error fetching categories.', 500);
    return data;
};

const getCategoryById = async (id) => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) throw new AppError('Category not found.', 404);
    return data;
};

const createCategory = async (data) => {
    const { data: category, error } = await supabase
        .from('categories')
        .insert(data)
        .select()
        .single();

    if (error) throw new AppError(error.message, 400);
    return category;
};

const updateCategory = async (id, data) => {
    const { data: category, error } = await supabase
        .from('categories')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error || !category) throw new AppError('Category not found.', 404);
    return category;
};

const deleteCategory = async (id) => {
    const { data, error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

    if (error || !data) throw new AppError('Category not found.', 404);
    return data;
};

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
};
