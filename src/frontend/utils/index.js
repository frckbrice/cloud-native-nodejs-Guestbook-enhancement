const moment = require('moment')
const config = require('../../shared/utils/config')

const timeAgo = (utcTime, currTime) => {
    const past = moment(utcTime)
    const result = past.from(moment(currTime))
    return result
}


const formatMessages = (messages) => {
    const currTime = moment.now()
    messages.forEach(message => {
        message.timeAgo = timeAgo(message.timestamp, currTime)
        // Ensure id is available for CRUD operations
        if (!message.id && message._id) {
            message.id = message._id.toString()
        }
        // Keep image URLs as relative paths - they will be served by the frontend proxy route
        // The frontend has a /uploads/* proxy route that forwards to the backend
        // No conversion needed - relative URLs work fine
    });
    return messages
}

module.exports = {
    timeAgo: timeAgo,
    formatMessages: formatMessages
}