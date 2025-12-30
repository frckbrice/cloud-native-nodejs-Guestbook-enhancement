const moment = require('moment')


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
    });
    return messages
}

module.exports = {
    timeAgo: timeAgo,
    formatMessages: formatMessages
}