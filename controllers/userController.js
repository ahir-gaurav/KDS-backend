const User = require('../models/User');

// GET /api/user/profile
const getProfile = async (req, res) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/user/profile
const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const user = await User.findById(req.user._id);
        if (name) user.name = name;
        if (phone) user.phone = phone;
        await user.save();
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/user/addresses
const addAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (req.body.isDefault) {
            user.addresses.forEach(a => (a.isDefault = false));
        }
        user.addresses.push(req.body);
        await user.save();
        res.json({ addresses: user.addresses });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/user/addresses/:addressId
const updateAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const address = user.addresses.id(req.params.addressId);
        if (!address) return res.status(404).json({ message: 'Address not found' });
        if (req.body.isDefault) {
            user.addresses.forEach(a => (a.isDefault = false));
        }
        Object.assign(address, req.body);
        await user.save();
        res.json({ addresses: user.addresses });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/user/addresses/:addressId
const deleteAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.addressId);
        await user.save();
        res.json({ addresses: user.addresses });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getProfile, updateProfile, addAddress, updateAddress, deleteAddress };
