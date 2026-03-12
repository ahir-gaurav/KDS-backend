/**
 * Computes the selling price from MRP and discount percentage.
 * @param {number} mrp - Maximum Retail Price
 * @param {number} discountPercent - Discount percentage (0–90)
 * @returns {number} Computed selling price (rounded to nearest rupee)
 */
function computeSellingPrice(mrp, discountPercent) {
    if (!mrp || mrp <= 0) return 0;
    const discount = Math.max(0, Math.min(90, Number(discountPercent) || 0));
    return Math.round(parseFloat(mrp) - (parseFloat(mrp) * discount / 100));
}

module.exports = { computeSellingPrice };
