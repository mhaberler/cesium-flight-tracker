const express = require('express');
const { Server } = require("socket.io");
const app = express();
require('dotenv').config();

const http = require("http");
const host = '0.0.0.0';
const port = 4711;


var httpserver = http.createServer(function (req, res) {
  switch (req.method) {
    case 'POST':
      var body = '';
      req.setEncoding('utf8');
      req.on('data', function (chunk) {
        if (process.env.DEBUG_SENSORLOGGER_REQUESTS === "1") {
          console.log('chunk: ' + chunk);
        }
        body += chunk;
      });
      req.on('end', function () {
        if (process.env.DEBUG_SENSORLOGGER_REQUESTS === "1") {
          console.log('end: ' + body);
        }
        io.emit('sensorlogger', body);
      });
      break;

    case 'GET':
      break;
  }
  res.writeHead(200);
  res.end();
});
httpserver.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});

app.use(require('morgan')('dev'));
app.use(express.static('dist'))

let server = app.listen(8000, function () {
  console.log('Cesium flight tracker app listening on port 8000');
});

const io = new Server(server);


io.on('connection', () => {
  console.log('server: cesium client connect')
  // replay history on reload
  // var prev_flight_data = fs.readFileSync("flight_data.json", 'utf-8');
  // socket.emit("prev_flight_data", prev_flight_data);
})

setInterval(() => {
  io.emit('keepalive', {});
}, 5000);

