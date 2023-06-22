<template>
  <div id="cesiumContainer"></div>
</template>

<script>
import * as Cesium from "cesium";
import "../../node_modules/cesium/Build/Cesium/Widgets/widgets.css";
import { io } from "socket.io-client";
import ReconnectingWebSocket from 'reconnecting-websocket';

// import "./css/main.css";
export default {
  name: "CesiumViewer",
  props: {
    msg: String
  },

  mounted: () => {
    const socket = io(window.location.host, { path: "/socket.io" });
    Cesium.Ion.defaultAccessToken = process.env.VUE_APP_ACCESS_TOKEN;

    try {
      var viewer = new Cesium.Viewer("cesiumContainer", {
        sceneMode: Cesium.SceneMode.SCENE3D,
        scene3DOnly: false, // Enable 2D and Columbus View
      });
    } catch (error) {
      console.log(error);
    }

    Cesium.createWorldTerrainAsync({
      requestVertexNormals: true,
    }).then((res) => {
      console.log('terrain provider is ready');
      viewer.terrainProvider = res;
    });

    // The SampledPositionedProperty stores the position and timestamp for each sample along the radar sample series.
    const positionProperty = new Cesium.SampledPositionProperty();
    positionProperty.forwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;

    const orientationProperty = new Cesium.SampledProperty(Cesium.Quaternion);
    orientationProperty.forwardExtrapolationType = Cesium.ExtrapolationType.EXTRAPOLATE;

    viewer.homeButton.viewModel.command.beforeExecute.addEventListener(
      // Return to the balloon when the home button is pressed.
      function (e) {
        console.log("Return to home. ie balloon.");
        e.cancel = true;
        if (balloonEntity == null) return;
        viewer.flyTo(balloonEntity);
      }
    );
    var teleplot_ws = null;

    var alpha = 0.2;
    var loc_interval_ms = -1; // updates/sec
    var last_loc_update_ms = null;

    // var start_time = null;
    // var stop_time = null; 
    var current_time = null;
    var current_time_ms = null;
    var balloonEntity = null;
    var norm_orient = new Cesium.Quaternion();
    var position, orientation;

    var clock_set = false;
    var loc_count = 0;
    var hpr = true;

    function teleplot(v) {
      if (teleplot_ws) {
        teleplot_ws.send(v);
      }
    }

    function addBalloon() {
      console.log("addBalloon");
      balloonEntity = viewer.entities.add({
        // add path for flight points we already know.
        // availability: new Cesium.TimeIntervalCollection([
        //   new Cesium.TimeInterval({ start: start_time, stop: current_time })
        // ]),
        position: positionProperty,
        // point: { pixelSize: 30, color: Cesium.Color.GREEN },
        model: { uri: "./CesiumBalloon.glb", maximumScale: 5000, minimumPixelSize: 64 },
        // model: { uri: balloonUri, maximumScale: 5000},
        orientation: orientationProperty,
        // orientation: new Cesium.VelocityOrientationProperty(positionProperty),
        path: new Cesium.PathGraphics({ width: 3 })
      });
    }
    addBalloon();

    socket.on("connect", () => {
      console.log("cesium client: connected");
    });

    socket.on("keepalive", () => {
      console.log('cesium client: got keepalive');
    });

    socket.on("sensorlogger", body => {
      // body is POSTed sensorlogger push data
      const msg = JSON.parse(body);
      msg.payload.forEach(p => {
        current_time_ms = p["time"] / 1000000;
        current_time = Cesium.JulianDate.fromDate(new Date(current_time_ms));

        if (p.name == "orientation") {
          // console.log("orientation");
          if (hpr) {
            if (position != null) {
              let hpr = new Cesium.HeadingPitchRoll(p.values.yaw, p.values.pitch, p.values.roll);
              // console.log("hpr:", p.values.yaw, p.values.pitch, p.values.roll);
              hpr.yaw -= Cesium.Math.PI_OVER_TWO;
              orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
              orientationProperty.addSample(current_time, orientation);
            }
          } else {
            orientation = new Cesium.Quaternion(p.values.qx, p.values.qy, p.values.qz, p.values.qw);
            Cesium.Quaternion.normalize(orientation, norm_orient);
            orientationProperty.addSample(current_time, norm_orient);
          }
        }
        if (p.name == "location") {
          // console.log("location");

          position = Cesium.Cartesian3.fromDegrees(
            p.values.longitude,
            p.values.latitude,
            p.values.altitude + 50
          );
          positionProperty.addSample(current_time, position);

          loc_count += 1;
          if (last_loc_update_ms == null) {
            last_loc_update_ms = current_time_ms;
            return;
          }
          if (loc_count == 2) {
            loc_interval_ms = current_time_ms - last_loc_update_ms;
            return;
          }
          teleplot(`loc_interval_raw:${loc_interval_ms}`);
          const current_time_interval_ms = current_time_ms - last_loc_update_ms;
          loc_interval_ms = alpha * current_time_interval_ms + (1 - alpha) * loc_interval_ms;
          teleplot(`loc_interval:${loc_interval_ms}`);

          console.log("loc_interval_ms: ", loc_interval_ms);
          last_loc_update_ms = current_time_ms;

          if (!clock_set && loc_count > 5) {
            console.log("start animation");

            viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
              current_time,
              - loc_interval_ms * 1.3 / 1000,
              new Cesium.JulianDate()
            );
            viewer.clock.shouldAnimate = true;
            clock_set = true;

            // viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
          }
        }
      });
    });

    // stop_time = Cesium.JulianDate.addSeconds(
    //   current_time,
    //   10,
    //   new Cesium.JulianDate()
    // );

    // Extend the life of the balloon object

    // if (balloonEntity != null) {
    //   balloonEntity.availability = new Cesium.TimeIntervalCollection([
    //     new Cesium.TimeInterval({ start: start_time, stop: stop_time })
    //   ]);
    //   console.log("quaternion");
    //   viewer.clock.shouldAnimate = false;
    //   viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
    //   // viewer.clock.stopTime = stop_time.clone(); // update the stop time
    //   // viewer.timeline.zoomTo(current_time, stop_time);
    // }
    // if (start_time == null) {
    //   start_time = current_time.addSeconds(-2);
    // }
    // viewer.trackedEntity = balloonEntity;
    // // Make the camera fly to the balloon.
    // viewer.flyTo(balloonEntity);


    // start_time = current_time.addSeconds(-2);

    // balloonEntity.availability = new Cesium.TimeIntervalCollection([
    //   new Cesium.TimeInterval({
    //     start: start_time, stop: Cesium.JulianDate.addSeconds(
    //       start_time,
    //       3600,
    //       new Cesium.JulianDate()
    //     )
    //   })
    // ]);
    // clock_set = true;
    // viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
    // viewer.trackedEntity = balloonEntity;
    // // Make the camera fly to the balloon.
    // viewer.flyTo(balloonEntity);
    // viewer.clock.shouldAnimate = false;


    // viewer.trackedEntity = balloonEntity;
    // // Make the camera fly to the balloon.
    // viewer.flyTo(balloonEntity);

    // Extend the life of the balloon object
    // balloonEntity.availability = new Cesium.TimeIntervalCollection([
    //   new Cesium.TimeInterval({ start: start_time, stop: stop_time })
    // ]);
    // viewer.clock.shouldAnimate = true;
    // viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
    // viewer.timeline.zoomTo(current_time, stop_time);


    // console.log(p);

    function connect() {
      var serverUrl;
      var scheme = "ws";

      // If this is an HTTPS connection, we have to use a secure WebSocket
      // connection too, so add another "s" to the scheme.

      if (document.location.protocol === "https:") {
        scheme += "s";
      }

      serverUrl = scheme + "://" + document.location.hostname + ":8081";

      teleplot_ws = new ReconnectingWebSocket(serverUrl, "json");
      console.log("ReconnectingWebSocket created");

      teleplot_ws.onopen = function () {
        console.log("onopen");
        // teleplot_ws.send("hi!");
      };

      teleplot_ws.onmessage = function (evt) {
        var msg = JSON.parse(evt.data);
        console.log("Message received: ");
        console.dir(msg);
      };
    }

    connect();

  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
div#cesiumContainer {
  /*height: 100vh;
  width: 100vw;*/
}
</style>
