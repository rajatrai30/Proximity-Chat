const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true
        },
        latitude: {
            type: String,
            required: true
        },
        longitude: {
            type: String,
            required: true
        },
        room: {
            type: String,
            required: true
        },
        socketId: {
            type: String,
            required: true
        }
    }
)

const User = mongoose.model('User', UserSchema);

module.exports = User;