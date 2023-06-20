const express = require('express');
const { Server } = require("socket.io");
const app = express();
const aprs = require("aprs-parser");
const fs = require("fs");
var net = require('net');
require('dotenv').config();

const http = require("http");
const host = '0.0.0.0';
const port = 4711;
var tracked_callsign = process.env.VUE_APP_TRACKED_CALLSIGN;

const requestListener = function (req, res) {
  // console.log('requestListener: '); // + JSON.stringify(req));
  // console.dir(req.body);

  if (req.method == 'POST') {
    console.log('POST')
    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      // console.log('Body: ' + JSON.stringify(body, null, 2))
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


console.log("Desired callsign target: " + tracked_callsign);

var gnuradio_server = net.createServer();
//emitted when server closes ...not emitted until all connections closes.
gnuradio_server.on('close', function () {
  console.log('GNURadio server closed !');
});

var duplicate_preventer_timestamp_ms = 0;
var buffer_time_ms = 7000; // To prevent duplicate packets from digipeaters. We expect new packets every 15 sec.
// emitted when new client connects
gnuradio_server.on('connection', function (socket) {
  socket.setEncoding("utf8");
  var rport = socket.remotePort;
  var raddr = socket.remoteAddress;
  var rfamily = socket.remoteFamily;

  console.log('REMOTE Socket port: ' + rport);
  console.log('REMOTE Socket ip : ' + raddr);
  console.log('REMOTE Socket is IP4/IP6 : ' + rfamily);

  console.log('--------------------------------------------')

  socket.on('data', function (new_flight_data) {
    const parser = new aprs.APRSParser();
    var flight_data_json = parser.parse(new_flight_data);
    if (flight_data_json.from == null ||
      flight_data_json.data == null ||
      flight_data_json.data.latitude == null ||
      flight_data_json.data.longitude == null ||
      flight_data_json.data.altitude == null) {
      // ARPS without a callsign origin, latitude, longitude and altitude to be discarded.
      console.log("\x1b[31m", "ERROR Unparsable data: " + new_flight_data, "\x1b[37m"); // output in red
      return;
    }
    var callsign = flight_data_json.from.call;
    if (callsign != tracked_callsign) {
      console.log("\x1b[33m%s\x1b[0m", "WARNING Undesired data: " + new_flight_data, "\x1b[37m"); // output in yellow
      return;
    }
    if (Date.now() - duplicate_preventer_timestamp_ms < buffer_time_ms) {
      // Likely to be a digipeater
      console.log("\x1b[33m%s\x1b[0m", "Likely repeated packet. Ignoring: " + new_flight_data, "\x1b[37m"); // output in yellow
      return;
    }
    duplicate_preventer_timestamp_ms = Date.now();
    var latitude = flight_data_json.data.latitude;
    var longitude = flight_data_json.data.longitude;
    var altitude = flight_data_json.data.altitude; // in meters
    var timestamp = flight_data_json.data.timestamp;
    if (timestamp == null) { // use system time received if timestamp is not present
      timestamp = new Date().toISOString();
    }
    var comment = flight_data_json.data.comment;
    var json_string = JSON.stringify({ "callsign": callsign, "longitude": longitude, "latitude": latitude, "height": altitude, "time": timestamp, "comment": comment });
    console.log("\x1b[32m", "Parsed  " + json_string, "\x1b[37m\n"); // output in green
    io.emit('new_flight_point', { "callsign": callsign, "longitude": longitude, "latitude": latitude, "height": altitude, "time": timestamp, "comment": comment }); // Push to webclient
    fs.appendFileSync("flight_data.json", json_string + '\n'); // Push to database
  });

  socket.on('drain', function () {
    console.log('write buffer is empty now .. u can resume the writable stream');
    socket.resume();
  });

  socket.on('error', function (error) {
    console.log('Error : ' + error);
  });

  socket.on('timeout', function () {
    console.log('Socket timed out !');
    socket.end('Timed out!');
    // can call socket.destroy() here too.
  });

  socket.on('end', function (data) {
    console.log('Socket ended from other end!');
    console.log('End data : ' + data);
  });

  socket.on('close', function (error) {
    var bread = socket.bytesRead;
    var bwrite = socket.bytesWritten;
    console.log('Bytes read : ' + bread);
    console.log('Bytes written : ' + bwrite);
    console.log('Socket closed!');
    if (error) {
      console.log('Socket was closed coz of transmission error');
    }
  });

}); // end of gnuradio_server on connection

// emits when any error occurs -> calls closed event immediately after this.
gnuradio_server.on('error', function (error) {
  console.log('Error: ' + error);
});

//emits when server is bound with server.listen
gnuradio_server.on('listening', function () {
  console.log('Server is listening!');
});

//static port allocation
gnuradio_server.listen(3000, '0.0.0.0');

var islistening = gnuradio_server.listening;

if (islistening) {
  console.log('Server is listening');
} else {
  console.log('Server is not listening');
}


// Tell express to use the webpack-dev-middleware and use the webpack.config.js
// configuration file as a base.
/*app.use(
  webpackDevMiddleware(compiler)
);*/
app.use(require('morgan')('dev'));
app.use(express.static('dist'))

// Serve the files on port 8000.
let server = app.listen(8000, function () {
  console.log('Cesium flight tracker app listening on port 8000!\n');
});

const io = new Server(server);


io.on('connection', (socket) => {
  console.log('connection')
  var prev_flight_data = fs.readFileSync("flight_data.json", 'utf-8');
  socket.emit("prev_flight_data", prev_flight_data);
})

setInterval(() => {
  io.emit('message', 'message')
}, 1000)

