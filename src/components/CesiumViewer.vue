<template>
  <div id="cesiumContainer"></div>
</template>

<script>
import * as Cesium from "cesium";
import "../../node_modules/cesium/Build/Cesium/Widgets/widgets.css";
import { io } from "socket.io-client";
// import "./css/main.css";
export default {
  name: "CesiumViewer",
  props: {
    msg: String
  },
  mounted: () => {
    const socket = io(window.location.host, { path: "/socket.io" });

    Cesium.Ion.defaultAccessToken = process.env.VUE_APP_ACCESS_TOKEN;

    var viewer = new Cesium.Viewer("cesiumContainer", {
      sceneMode: Cesium.SceneMode.SCENE3D,
      terrainProvider: Cesium.createWorldTerrain({
        requestVertexNormals: true
      }),
      scene3DOnly: false, // Enable 2D and Columbus View
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

    var start_time = null; // for two different socket callbacks to manipulate the start time of the animation
    // var stop_time = null; // for two different socket callbacks to manipulate the stop time of the animation
    var current_time = null; // for two different socket callbacks to manipulate the current time of the animation
    var balloonEntity = null; // for two different socket callbacks to manipulate the entity that models the position of the balloon
    var norm_orient = new Cesium.Quaternion();
    var position, orientation;

    var clock_set = false;
    var loc_count = 0;
    var hpr = true;

    socket.on("connect", () => {
      console.log("client: connected");
    });

    socket.on("keepalive", () => {
      console.log('client: got keepalive');
    });

    socket.on("sensorlogger", body => {
      // body is POSTed sensorlogger push data
      const msg = JSON.parse(body);
      msg.payload.forEach(p => {
        current_time = Cesium.JulianDate.fromDate(new Date(p["time"] / 1000000));
        // stop_time = Cesium.JulianDate.addSeconds(
        //   current_time,
        //   10,
        //   new Cesium.JulianDate()
        // );
        if (p.name == "orientation") {
          if (hpr) {
            if (position != null) {
              let hpr = new Cesium.HeadingPitchRoll(p.values.heading, p.values.pitch, p.values.roll);
              hpr.heading -= Cesium.Math.PI_OVER_TWO;
              orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
              orientationProperty.addSample(current_time, orientation);
            }
          } else {
            orientation = new Cesium.Quaternion(p.values.qx, p.values.qy, p.values.qz, p.values.qw);
            Cesium.Quaternion.normalize(orientation, norm_orient);
            orientationProperty.addSample(current_time, norm_orient);
          }
          console.log("orientation");

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
        }
        if (p.name == "location") {
          loc_count += 1;
          // if (start_time == null) {
          //   start_time = current_time.addSeconds(-2);
          // }
          if (balloonEntity == null) {
            console.log("add baloon");

            balloonEntity = viewer.entities.add({
              // add path for flight points we already know.
              // availability: new Cesium.TimeIntervalCollection([
              //   new Cesium.TimeInterval({ start: start_time, stop: current_time })
              // ]),
              position: positionProperty,
              // point: { pixelSize: 30, color: Cesium.Color.GREEN },
              model: { uri: "./CesiumBalloon.glb", maximumScale: 5000, minimumPixelSize: 32 },
              // model: { uri: balloonUri, maximumScale: 5000},
              orientation: orientationProperty,
              // orientation: new Cesium.VelocityOrientationProperty(positionProperty),
              path: new Cesium.PathGraphics({ width: 3 })
            });
            // viewer.trackedEntity = balloonEntity;
            // // Make the camera fly to the balloon.
            // viewer.flyTo(balloonEntity);
          }
          if (!clock_set && loc_count > 3) {
            start_time = Cesium.JulianDate.addSeconds(
              current_time,
              -2,
              new Cesium.JulianDate()
            );

            // start_time = current_time.addSeconds(-2);

            balloonEntity.availability = new Cesium.TimeIntervalCollection([
              new Cesium.TimeInterval({
                start: start_time, stop: Cesium.JulianDate.addSeconds(
                  start_time,
                  3600,
                  new Cesium.JulianDate()
                )
              })
            ]);
            clock_set = true;
            viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
            viewer.trackedEntity = balloonEntity;
            // Make the camera fly to the balloon.
            viewer.flyTo(balloonEntity);
            viewer.clock.shouldAnimate = false;

          }
          // viewer.trackedEntity = balloonEntity;
          // // Make the camera fly to the balloon.
          // viewer.flyTo(balloonEntity);


          position = Cesium.Cartesian3.fromDegrees(
            p.values.longitude,
            p.values.latitude,
            p.values.altitude
          );
          positionProperty.addSample(current_time, position);
          viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI

          // Extend the life of the balloon object
          // balloonEntity.availability = new Cesium.TimeIntervalCollection([
          //   new Cesium.TimeInterval({ start: start_time, stop: stop_time })
          // ]);
          // viewer.clock.shouldAnimate = true;
          // viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
          // viewer.timeline.zoomTo(current_time, stop_time);

          console.log("location");
        }
        // console.log(p);
      });
    });

  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
div#cesiumContainer {
  /*height: 100vh;
  width: 100vw;*/
}
</style>
