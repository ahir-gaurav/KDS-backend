const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const adminProtect = async (req, res, next) => {
    try {
        let token = req.cookies?.adminToken || req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no admin token' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = await Admin.findById(decoded.id).select('-password');
        if (!req.admin) {
            return res.status(401).json({ message: 'Admin not found' });
        }
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Not authorized, admin token failed' });
    }
};

module.exports = { adminProtect };
