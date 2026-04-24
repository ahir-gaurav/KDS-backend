// backend/config/env.js
'use strict';

/**
 * Validated environment loader.
 * Call validateEnv() once at startup — it throws if required vars are missing,
 * so the process fails fast rather than producing subtle runtime bugs.
 */

const REQUIRED_VARS = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
];

const OPTIONAL_WITH_DEFAULTS = {
    NODE_ENV:  'development',
    PORT:      '5000',
    JWT_EXPIRES_IN:         '7d',
    JWT_REFRESH_EXPIRES_IN: '30d',
    COOKIE_SECURE: 'false',
};

const validateEnv = () => {
    require('dotenv').config();

    // Apply defaults for optional vars
    for (const [key, value] of Object.entries(OPTIONAL_WITH_DEFAULTS)) {
        if (!process.env[key]) process.env[key] = value;
    }

    const missing = REQUIRED_VARS.filter((v) => !process.env[v]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing.join(', '));
        process.exit(1);
    }

    console.log('✅ Environment validated successfully');
};

module.exports = { validateEnv };
