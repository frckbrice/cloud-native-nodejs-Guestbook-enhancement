const mongoose = require('mongoose');
const logger = require('../../shared/utils/logger');
const { retry } = require('../../shared/utils/retry');
const config = require('../../shared/utils/config');

const mongoURI = `mongodb://${config.dbAddress}/guestbook`;

const db = mongoose.connection;

db.on('disconnected', () => {
    logger.warn('MongoDB disconnected', { uri: mongoURI });
});

db.on('error', (err) => {
    logger.error('MongoDB connection error', { uri: mongoURI, error: err.message });
});

db.once('open', () => {
    logger.info('MongoDB connected successfully', { uri: mongoURI });
});

db.on('reconnected', () => {
    logger.info('MongoDB reconnected', { uri: mongoURI });
});

const connectToMongoDB = async () => {
    if (!config.dbAddress) {
        const error = new Error('GUESTBOOK_DB_ADDR environment variable is not defined');
        logger.error('Database configuration missing', { error: error.message });
        throw error;
    }

    const connectWithRetry = async () => {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            minPoolSize: 2
        });
    };

    try {
        await retry(connectWithRetry, {
            maxRetries: 5,
            initialDelay: 2000,
            maxDelay: 10000
        });
    } catch (error) {
        logger.error('Failed to connect to MongoDB after retries', {
            uri: mongoURI,
            error: error.message
        });
        throw error;
    }
};

const messageSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name must be less than 100 characters']
    },
    body: {
        type: String,
        required: [true, 'Message Body is required'],
        trim: true,
        maxlength: [5000, 'Message must be less than 5000 characters']
    },
    imageUrl: {
        type: String,
        required: false,
        trim: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
}, {
    timestamps: true
});

const messageModel = mongoose.model('Message', messageSchema);

const construct = (params) => {
    const { name, body, imageUrl, userId } = params;
    return new messageModel({ name, body, imageUrl, userId });
};

const save = async (message) => {

    try {
        await message.save();
    } catch (error) {
        logger.error('Failed to save message to database', {
            error: error.message,
            hasName: !!message.name,
            hasUserId: !!message.userId,
            hasImageUrl: !!message.imageUrl,
            messageId: message._id.toString(),
            stack: error.stack
        });
        throw error;
    }
};

const create = async (params) => {
    try {
        const msg = construct(params);
        const validationError = msg.validateSync();
        if (validationError) {
            throw validationError;
        }
        await save(msg);
        return msg;
    } catch (error) {
        logger.error('Failed to create message', { error: error.message });
        throw error;
    }
};

const findAll = async (options = {}) => {
    try {
        const page = parseInt(options.page) || 1;
        const limit = parseInt(options.limit) || 20;
        const skip = (page - 1) * limit;

        const query = messageModel.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const [messages, totalCount] = await Promise.all([
            query.exec(),
            messageModel.countDocuments({})
        ]);

        logger.info('Retrieved messages from database', {
            count: messages.length,
            page,
            limit,
            totalCount,
            hasMessages: messages.length > 0
        });

        return {
            messages: messages.map(msg => ({
                id: msg._id.toString(),
                name: msg.name,
                body: msg.body,
                imageUrl: msg.imageUrl,
                userId: msg.userId ? msg.userId.toString() : null,
                timestamp: msg.createdAt || msg._id.getTimestamp()
            })),
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        };
    } catch (error) {
        logger.error('Failed to retrieve messages', { error: error.message });
        throw error;
    }
};

const findById = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error = new Error('Invalid message ID');
            error.name = 'ValidationError';
            throw error;
        }
        const message = await messageModel.findById(id).lean();
        if (!message) {
            const error = new Error('Message not found');
            error.statusCode = 404;
            throw error;
        }
        return {
            id: message._id.toString(),
            name: message.name,
            body: message.body,
            imageUrl: message.imageUrl,
            userId: message.userId ? message.userId.toString() : null,
            timestamp: message.createdAt || message._id.getTimestamp()
        };
    } catch (error) {
        logger.error('Failed to find message', { id, error: error.message });
        throw error;
    }
};

const update = async (id, params) => {
    try {

        if (!mongoose.Types.ObjectId.isValid(id)) {
            logger.warn('Invalid message ID format', { id });
            const error = new Error('Invalid message ID');
            error.name = 'ValidationError';
            throw error;
        }
        const message = await messageModel.findById(id);
        if (!message) {
            logger.warn('Message not found for update', { id });
            const error = new Error('Message not found');
            error.statusCode = 404;
            throw error;
        }

        message.name = params.name || message.name;
        message.body = params.body || message.body;
        if (params.imageUrl !== undefined) {
            message.imageUrl = params.imageUrl;
        }
        const validationError = message.validateSync();
        if (validationError) {
            logger.warn('Message validation failed during update', {
                id,
                validationErrors: validationError.errors
            });
            throw validationError;
        }
        await save(message);
        return message;
    } catch (error) {
        logger.error('Failed to update message in database', {
            id,
            error: error.message,
            errorName: error.name,
            stack: error.stack
        });
        throw error;
    }
};

const remove = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            logger.warn('Invalid message ID format for deletion', { id });
            const error = new Error('Invalid message ID');
            error.name = 'ValidationError';
            throw error;
        }
        const message = await messageModel.findByIdAndDelete(id);
        if (!message) {
            logger.warn('Message not found for deletion', { id });
            const error = new Error('Message not found');
            error.statusCode = 404;
            throw error;
        }
        return message;
    } catch (error) {
        logger.error('Failed to delete message from database', {
            id,
            error: error.message,
            errorName: error.name,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = {
    create,
    findAll,
    findById,
    update,
    remove,
    messageModel,
    connectToMongoDB
};

