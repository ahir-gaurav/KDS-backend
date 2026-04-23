// backend/utils/slugify.js
'use strict';

/**
 * Convert any string to a URL-safe slug.
 * e.g. "Nike Air Max 90 (Ltd. Ed.)" → "nike-air-max-90-ltd-ed"
 */
const slugify = (str) =>
    str
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')    // remove non-word chars except hyphens
        .replace(/[\s_]+/g, '-')     // spaces / underscores → hyphens
        .replace(/-+/g, '-');        // collapse multiple hyphens

module.exports = slugify;
