const express = require('express');
const { Server } = require("socket.io");
const app = express();
const fs = require("fs");
var net = require('net');
require('dotenv').config();

const http = require("http");
const host = '0.0.0.0';
const port = 4711;

const requestListener = function (req, res) {
  if (req.method == 'POST') {
    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      io.emit('sensorlogger', body); // Push to webclient
    })
  }
  res.writeHead(200);
  res.end();
};

const httpserver = http.createServer(requestListener);
httpserver.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
httpserver.on('connect', function (req, socket, head) {
  console.log('sensorlogger connect');
});
httpserver.on('disconnect', function (req, socket, head) {
  console.log('sensorlogger disconnect');
});


app.use(require('morgan')('dev'));
app.use(express.static('dist'))

let server = app.listen(8000, function () {
  console.log('Cesium flight tracker app listening on port 8000!\n');
});

const io = new Server(server);


io.on('connection', (socket) => {
  console.log('server: cesium client connect')
  // replay history on reload
  // var prev_flight_data = fs.readFileSync("flight_data.json", 'utf-8');
  // socket.emit("prev_flight_data", prev_flight_data);
})

setInterval(() => {
  io.emit('keepalive', {});
}, 5000);

