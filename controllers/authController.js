const jwt = require('jsonwebtoken');
const { createPublicKey } = require('crypto');
const User = require('../models/User');
const { generateOTP } = require('../utils/helpers');
const { sendWelcomeOTP, sendPasswordResetOTP } = require('../services/email');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// In-memory JWKS cache
const jwksCache = {};

const fetchClerkJWKS = async (issuer) => {
    const cached = jwksCache[issuer];
    if (cached && Date.now() - cached.time < 3600000) return cached.keys;
    const res = await fetch(`${issuer}/.well-known/jwks.json`);
    if (!res.ok) throw new Error('Failed to fetch Clerk JWKS');
    const { keys } = await res.json();
    jwksCache[issuer] = { keys, time: Date.now() };
    return keys;
};

const verifyClerkToken = async (token) => {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.payload?.iss) throw new Error('Invalid Clerk token');
    const { iss } = decoded.payload;
    if (!iss.includes('clerk')) throw new Error('Not a Clerk token');
    const keys = await fetchClerkJWKS(iss);
    const matchingKey = keys.find(k => k.kid === decoded.header.kid);
    if (!matchingKey) throw new Error('Clerk signing key not found');
    const publicKey = createPublicKey({ key: matchingKey, format: 'jwk' });
    return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
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

// POST /api/auth/clerk-sync
// Called by the frontend after Clerk sign-in to get a backend JWT
const clerkSync = async (req, res) => {
    try {
        const { clerkToken, email, name } = req.body;
        if (!clerkToken || !email) {
            return res.status(400).json({ message: 'clerkToken and email are required' });
        }

        // Verify the Clerk JWT signature — this proves the email is authentic
        await verifyClerkToken(clerkToken);

        // Find or create the backend user by email
        let user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Auto-create a backend user for this Clerk-authenticated user
            user = await User.create({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                password: jwt.sign({ email }, process.env.JWT_SECRET), // placeholder, won't be used
                isVerified: true,
            });
        } else if (!user.isVerified) {
            // If the user registered via old flow but didn't verify, trust Clerk
            user.isVerified = true;
            await user.save();
        }

        const token = generateToken(user._id);
        setCookie(res, token);
        res.json({
            message: 'Synced',
            token,
            user: { id: user._id, name: user.name, email: user.email },
        });
    } catch (error) {
        console.error('Clerk sync error:', error.message);
        res.status(401).json({ message: 'Clerk token verification failed' });
    }
};

module.exports = { signup, verifyOTP, login, logout, getMe, forgotPassword, resetPassword, clerkSync };
