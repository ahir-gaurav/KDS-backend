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
        console.log('Update profile request body:', req.body);
        console.log(`Update profile attempt for user ID: ${req.user._id}`);
        
        const user = await User.findById(req.user._id);
        if (!user) {
            console.log('User not found in updateProfile for ID:', req.user._id);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Current user in DB:', { name: user.name, phone: user.phone, email: user.email });

        if (name !== undefined) user.name = name;
        if (phone !== undefined) user.phone = phone;
        
        console.log('Saving user profile...');
        await user.save();
        console.log('Profile updated successfully');
        res.json({ user });
    } catch (error) {
        console.error('Update profile full error:', error);
        res.status(500).json({ message: 'Server error', error: error.message, stack: error.stack });
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
