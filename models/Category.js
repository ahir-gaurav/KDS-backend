// backend/models/Category.js
'use strict';

const mongoose = require('mongoose');
const slugify  = require('../utils/slugify');

const categorySchema = new mongoose.Schema(
    {
        name:   { type: String, required: true, trim: true, unique: true },
        slug:   { type: String, unique: true, lowercase: true },
        parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
        image:  { type: String },        // Cloudinary URL
        isActive: { type: Boolean, default: true },
        order:  { type: Number, default: 0 },  // Display order
    },
    { timestamps: true }
);

// ── Auto-generate slug ────────────────────────────────────────────────────────
categorySchema.pre('save', function (next) {
    if (this.isModified('name')) this.slug = slugify(this.name);
    next();
});

categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });

module.exports = mongoose.model('Category', categorySchema);
