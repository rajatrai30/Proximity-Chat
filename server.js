require('dotenv').config()
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const User = require('./model')
const userMap = new Map();

const uniqid = require('uniqid')

const { sin, cos, sqrt, atan2 } = Math;
const proximityThreshold = 30

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert coordinates to radians
  const lat1Rad = radians(lat1);
  const lon1Rad = radians(lon1);
  const lat2Rad = radians(lat2);
  const lon2Rad = radians(lon2);

  // Radius of the Earth in kilometers
  const radius = 6371;

  // Haversine formula
  const dlat = lat2Rad - lat1Rad;
  const dlon = lon2Rad - lon1Rad;
  const a = sin(dlat / 2) ** 2 + cos(lat1Rad) * cos(lat2Rad) * sin(dlon / 2) ** 2;
  const c = 2 * atan2(sqrt(a), sqrt(1 - a));
  const distance = radius * c;

  return distance;
}

const lat1 = 12.872725;
const lon1 = 74.8366696;
const lat2 = 12.8881078;
const lon2 = 74.840655;

const distance = calculateDistance(lat1, lon1, lat2, lon2);
// console.log(`The distance between the two locations is ${distance.toFixed(2)} kilometers.`);


const mongoose = require('mongoose');
// Mongoose local connection
// mongoose.set('strictQuery', false);
// const connectionParams = {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// }
// mongoose.connect('mongodb://127.0.0.1:27017/proximity?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.6.0', connectionParams)
//   .then(() => {
//     console.log('Connected to the database ')
//   })
//   .catch((err) => {
//     console.error(`Error connecting to the database. n${err}`);
//   })

mongoose.set('strictQuery', false);
const connectionParams = {
  useNewUrlParser: true,
  useUnifiedTopology: true
}
mongoose.connect(process.env.MONGO_URL, connectionParams)
  .then(() => {
    console.log('Connected to the database ')
  })
  .catch((err) => {
    console.error(`Error connecting to the database. n${err}`);
  })

app.use(express.static((__dirname)))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  socket.on('location', async (location) => {
    console.log(location);
    const longitude = location.longitude;
    const latitude = location.latitude;
    const username = location.user
    try {
      let flag = false
      const users = await User.find({})
      const socketId = socket.id
      let room = ''
      users.every(async (u) => {
        if (calculateDistance(latitude, longitude, u.latitude, u.longitude) <= proximityThreshold) {
          // join that users room then break
          // console.log('for the user: ', username);
          // console.log('with the user: ', u.username);
          flag = true
          socket.join(u.room)
          room = u.room
          return false
        }
      })
      if (flag) {
        userMap.set(socket.id, { room, username });
        const user = await User.create({
          username,
          latitude,
          longitude,
          room,
          socketId
        })
        user.save()
        io.emit('room', room)
        io.to(room).emit('new user', { name: username, roomId: room });
        io.to(user.room).emit('count', userMap.size)
      }
      // if none of the users satisfy the condition then create a new room and save it into db
      if (!flag) {
        const room = uniqid()
        socket.join(room)
        userMap.set(socket.id, { room, username });
        const socketId = socket.id
        const user = await User.create({
          username,
          latitude,
          longitude,
          room,
          socketId
        })
        user.save()
        io.emit('room', room)
        io.to(room).emit('new user', { name: username, roomId: room });
        io.to(user.room).emit('count', userMap.size)
      }

    } catch (error) {
      const deletUser = await User.findOneAndDelete({ username: username })
      const user = await User.create({
        username,
        latitude,
        longitude
      })
    }
  })

  // This connection is not being used???
  socket.on('new user', (user) => {
    console.log('got new user signal');
    console.log('new user:')
    console.log(user);
    // io.emit('new user', user);
    // since server is not receiving any roomId its not executing the below code
    io.to(user.room).emit('count', userMap.size)
    console.log('hello');
    io.to(user.room).emit('new user', user);
  })

  socket.on('chat message', (msg) => {
    io.to(msg.room).emit('chat message', msg);
    // io.emit('chat message', msg);
    console.log(msg);
  });
  socket.on('disconnect', async () => {
    const user = userMap.get(socket.id);
    if (user) {
      console.log(`User '${user.username}' disconnected from room: ${user.room}`);
      io.to(user.room).emit('user left', user.username)
      const delUser = await User.deleteMany({ socketId: socket.id })
      delUser
      userMap.delete(socket.id);
      io.to(user.room).emit('count', userMap.size)
    }
    // console.log(userMap);
  })
});

server.listen(3000 || process.env.PORT, () => {
  console.log('listening on *:3000');
});