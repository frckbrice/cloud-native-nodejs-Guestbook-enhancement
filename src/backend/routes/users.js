/**
 * User Model and Authentication Routes
 * 
 * Provides user registration, login, and user management functionality
 */

const mongoose = require('mongoose');
const logger = require('../../shared/utils/logger');
const auth = require('../../shared/utils/auth');

const userSchema = mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username must be less than 30 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters']
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    // Skip if password hasn't been modified (and it's not a new document)
    if (!this.isModified('password') && !this.isNew) {
        return next();
    }

    // Skip if password is already hashed (starts with $2a$, $2b$, or $2y$)
    // This prevents double-hashing if password is already hashed
    if (this.password && /^\$2[aby]\$\d+\$/.test(String(this.password))) {
        logger.debug('Password already hashed, skipping re-hash', {
            username: this.username,
            hashPrefix: String(this.password).substring(0, 10)
        });
        return next();
    }

    if (!this.password) {
        logger.warn('No password provided for user', { username: this.username });
        return next();
    }

    try {
        const plainPassword = String(this.password);
        logger.debug('Hashing password for user', {
            username: this.username,
            isNew: this.isNew,
            isModified: this.isModified('password'),
            passwordLength: plainPassword.length
        });
        this.password = await auth.hashPassword(plainPassword);
        logger.debug('Password hashed successfully', {
            username: this.username,
            hashPrefix: this.password.substring(0, 10)
        });
        next();
    } catch (error) {
        logger.error('Password hashing failed in pre-save hook', {
            username: this.username,
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
});

const userModel = mongoose.model('User', userSchema);

const create = async (userData) => {
    try {
        const user = new userModel(userData);
        await user.save();

        // Verify password was hashed correctly
        const passwordHash = user.password;
        const isValidHash = /^\$2[aby]\$\d+\$/.test(passwordHash);

        return {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };
    } catch (error) {
        logger.error('Failed to create user', {
            error: error.message,
            name: error.name,
            code: error.code,
            keyPattern: error.keyPattern,
            keyValue: error.keyValue,
            errors: error.errors,
            stack: error.stack
        });
        // Re-throw with more context for duplicate key errors
        if (error.code === 11000 || error.code === 11001) {
            const duplicateField = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'field';
            const duplicateError = new Error(`User with this ${duplicateField} already exists`);
            duplicateError.statusCode = 409;
            duplicateError.name = 'ConflictError';
            throw duplicateError;
        }
        // Re-throw Mongoose validation errors with better formatting
        if (error.name === 'ValidationError') {
            const validationError = new Error('Validation failed');
            validationError.name = 'ValidationError';
            validationError.details = Object.values(error.errors).map(err => err.message);
            throw validationError;
        }
        throw error;
    }
};

const findByUsername = async (username) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            logger.error('MongoDB not connected', { readyState: mongoose.connection.readyState });
            throw new Error('Database connection not available');
        }

        // Trim whitespace and use case-insensitive search
        const trimmedUsername = username ? username.trim() : '';
        if (!trimmedUsername) {
            logger.warn('Empty username provided to findByUsername');
            return null;
        }

        // Escape special regex characters in username
        const escapedUsername = trimmedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Use case-insensitive regex for username search
        // First try exact match (case-sensitive) for performance
        let user = await userModel.findOne({ username: trimmedUsername }).lean();

        // If not found, try case-insensitive search
        if (!user) {
            user = await userModel.findOne({
                username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') }
            }).lean();
        }

        if (!user) {
            logger.debug('User not found by username', {
                searchedUsername: trimmedUsername,
                originalUsername: username,
                dbState: mongoose.connection.readyState
            });
        } else {
            logger.debug('User found by username', {
                username: user.username,
                userId: user._id,
                matchedCase: user.username === trimmedUsername
            });
        }

        return user;
    } catch (error) {
        logger.error('Failed to find user by username', {
            username,
            error: error.message,
            stack: error.stack,
            dbState: mongoose.connection.readyState
        });
        throw error;
    }
};

const findByEmail = async (email) => {
    try {
        const user = await userModel.findOne({ email }).lean();
        return user;
    } catch (error) {
        logger.error('Failed to find user by email', { email, error: error.message });
        throw error;
    }
};

const findById = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return null;
        }
        const user = await userModel.findById(id).select('-password').lean();
        return user;
    } catch (error) {
        logger.error('Failed to find user by id', { id, error: error.message });
        throw error;
    }
};

module.exports = {
    userModel,
    create,
    findByUsername,
    findByEmail,
    findById
};

