const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateOTP } = require('../utils/helpers');
const { sendWelcomeOTP, sendPasswordResetOTP } = require('../services/email');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const setCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

// POST /api/auth/signup
const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const existing = await User.findOne({ email });
        if (existing && existing.isVerified) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        if (existing && !existing.isVerified) {
            existing.name = name;
            existing.password = password;
            existing.verificationOTP = otp;
            existing.verificationOTPExpiry = expiry;
            await existing.save();
            await sendWelcomeOTP(existing, otp);
            return res.status(200).json({ message: 'OTP resent to email', email });
        }

        const user = new User({
            name,
            email,
            password,
            verificationOTP: otp,
            verificationOTPExpiry: expiry,
        });
        await user.save();
        await sendWelcomeOTP(user, otp);
        return res.status(201).json({ message: 'OTP sent to email', email });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.isVerified) return res.status(400).json({ message: 'Already verified' });
        if (user.verificationOTP !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        if (user.verificationOTPExpiry < new Date()) return res.status(400).json({ message: 'OTP expired' });

        user.isVerified = true;
        user.verificationOTP = undefined;
        user.verificationOTPExpiry = undefined;
        await user.save();

        const token = generateToken(user._id);
        setCookie(res, token);
        res.status(200).json({ message: 'Email verified', token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        if (!user.isVerified) return res.status(401).json({ message: 'Please verify your email first' });
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = generateToken(user._id);
        setCookie(res, token);
        res.json({ message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/auth/logout
const logout = async (req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
    res.json({ message: 'Logged out' });
};

// GET /api/auth/me
const getMe = async (req, res) => {
    res.json({ user: req.user });
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'No account with this email' });

        const otp = generateOTP();
        user.resetOTP = otp;
        user.resetOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        await sendPasswordResetOTP(user, otp);
        res.json({ message: 'OTP sent to email', email });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.resetOTP !== otp) return res.status(400).json({ message: 'Invalid OTP' });
        if (user.resetOTPExpiry < new Date()) return res.status(400).json({ message: 'OTP expired' });

        user.password = newPassword;
        user.resetOTP = undefined;
        user.resetOTPExpiry = undefined;
        await user.save();
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { signup, verifyOTP, login, logout, getMe, forgotPassword, resetPassword };
