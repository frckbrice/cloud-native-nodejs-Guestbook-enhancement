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
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        this.password = await auth.hashPassword(this.password);
        next();
    } catch (error) {
        next(error);
    }
});

const userModel = mongoose.model('User', userSchema);

const create = async (userData) => {
    try {
        const user = new userModel(userData);
        await user.save();
        logger.info('User created successfully', { userId: user._id, username: user.username });
        return {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };
    } catch (error) {
        logger.error('Failed to create user', { error: error.message });
        throw error;
    }
};

const findByUsername = async (username) => {
    try {
        const user = await userModel.findOne({ username }).lean();
        return user;
    } catch (error) {
        logger.error('Failed to find user by username', { username, error: error.message });
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

