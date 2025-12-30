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
    }
}, {
    timestamps: true
});

const messageModel = mongoose.model('Message', messageSchema);

const construct = (params) => {
    const { name, body } = params;
    return new messageModel({ name, body });
};

const save = async (message) => {
    logger.debug('Saving message', { name: message.name });
    try {
        await message.save();
        logger.info('Message saved successfully', { messageId: message._id });
    } catch (error) {
        logger.error('Failed to save message', { error: error.message });
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

const findAll = async () => {
    try {
        const messages = await messageModel.find({})
            .sort({ createdAt: -1 })
            .lean()
            .exec();
        logger.debug('Retrieved messages', { count: messages.length });
        return messages.map(msg => ({
            name: msg.name,
            body: msg.body,
            timestamp: msg.createdAt || msg._id.getTimestamp()
        }));
    } catch (error) {
        logger.error('Failed to retrieve messages', { error: error.message });
        throw error;
    }
};

module.exports = {
    create,
    findAll,
    messageModel,
    connectToMongoDB
};

