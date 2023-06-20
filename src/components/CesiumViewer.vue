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

    socket.on("connect", () => {
      console.log("connect");
    });

    Cesium.Ion.defaultAccessToken = process.env.VUE_APP_ACCESS_TOKEN;

    var viewer = new Cesium.Viewer("cesiumContainer", {
      sceneMode: Cesium.SceneMode.SCENE3D,
      terrainProvider: Cesium.createWorldTerrain({
        requestVertexNormals: true
      }),
      scene3DOnly: false // Enable 2D and Columbus View
    });

    //viewer.scene.primitives.add(Cesium.createOsmBuildings());
    // The SampledPositionedProperty stores the position and timestamp for each sample along the radar sample series.
    const positionProperty = new Cesium.SampledPositionProperty();
    const orientationProperty = new Cesium.SampledProperty(Cesium.Quaternion);

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
    var stop_time = null; // for two different socket callbacks to manipulate the stop time of the animation
    var current_time = null; // for two different socket callbacks to manipulate the current time of the animation
    var balloonEntity = null; // for two different socket callbacks to manipulate the entity that models the position of the balloon

    // On fresh reload, get existing flight data from the server to plot
    socket.on("prev_flight_data", prev_flight_points => {
      if (prev_flight_points == null) return;
      prev_flight_points = prev_flight_points.split("\n");
      for (var i = 0; i < prev_flight_points.length; i++) {
        if (prev_flight_points[i] == "") continue; // Ignore empty strings from the delimiter split
        if (start_time == null)
          start_time = Cesium.JulianDate.fromIso8601(
            JSON.parse(prev_flight_points[i]).time
          ); // Take the first flight data point as the start point. Assumes flight data is in order.
        current_time = Cesium.JulianDate.fromIso8601(
          JSON.parse(prev_flight_points[i]).time
        ); // Update the current time until we reach the last timestamp
        var flight_point = JSON.parse(prev_flight_points[i]);
        if (flight_point.height > 100000) flight_point.height = 0;
        console.log(i, ": ", flight_point);
        // Declare the time for this individual sample and store it in a new JulianDate instance.
        const time = Cesium.JulianDate.fromIso8601(flight_point.time); // Assumes timestamp is in Iso8601.
        const position = Cesium.Cartesian3.fromDegrees(
          flight_point.longitude,
          flight_point.latitude,
          flight_point.height
        );
        // Store the position along with its timestamp.
        // var comment = flight_point.comment.slice(0,-16); // Edit if necessary for your specific mission
        // Here we add the positions all upfront, but these can be added at run-time as samples are received from a server.
        positionProperty.addSample(time, position);
        viewer.entities.add({
          description: `Location: (${flight_point.longitude}, ${flight_point.latitude}, ${flight_point.height})`,
          label: {
            text:
              "Time: " +
              time +
              "; Alt: " +
              Math.round(flight_point.height) +
              " m",
            font: "14pt monospace",
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -9),
            scaleByDistance: new Cesium.NearFarScalar(0, 1, 10000, 0.0)
          },
          position: position,
          point: { pixelSize: 10, color: Cesium.Color.RED }
        });
      }
      if (start_time == null || current_time == null) return; // For the case that there is no previous flight data
      viewer.clock.currentTime = current_time.clone(); // current_time should be the latest packet reported. Set current_time before we add a 1sec delay to the stop_time.
      stop_time = Cesium.JulianDate.addSeconds(
        current_time,
        1,
        new Cesium.JulianDate()
      ); // if we only have 1 data point, stop_time > start_time
      console.log("Clock interval: " + start_time + " to " + stop_time);
      viewer.clock.startTime = start_time.clone();
      viewer.clock.stopTime = stop_time.clone();
      viewer.timeline.zoomTo(start_time, stop_time);
      viewer.clock.shouldAnimate = false;
      balloonEntity = viewer.entities.add({
        // add path for flight points we already know.
        availability: new Cesium.TimeIntervalCollection([
          new Cesium.TimeInterval({ start: start_time, stop: stop_time })
        ]),
        position: positionProperty,
        // point: { pixelSize: 30, color: Cesium.Color.GREEN },
        model: { uri: "./CesiumBalloon.glb", maximumScale: 5000 },
        // model: { uri: balloonUri, maximumScale: 5000},
        orientation: new Cesium.VelocityOrientationProperty(positionProperty),
        path: new Cesium.PathGraphics({ width: 3 })
      });
      viewer.trackedEntity = undefined;
      // Make the camera fly to the balloon.
      viewer.flyTo(balloonEntity);
    });

    // \"messageId\":78,\"sessionId\":\"ff695557-89c7-4cc2-ac5b-02bda569e900\",\"deviceId\":\"1d6b3d72-643c-433c-b622-2a62cfbe7afe\",\"payload\":[{\"name\":\"orientation\",\"values\":{\"qz\":-0.9200320243835449,\"qy\":-0.3867120146751404,\"qx\":0.06201799958944321,\"qw\":0.012174000032246113,\"roll\":0.14990438520908356,\"pitch\":-0.7938886284828186,\"yaw\":-3.105118751525879},\"accuracy\":3,\"time\":1687242931159515600},{\"values\":{\"bearingAccuracy\":0,\"speedAccuracy\":0,\"verticalAccuracy\":1.7729943990707397,\"horizontalAccuracy\":20.899999618530273,\"speed\":0,\"bearing\":0,\"altitude\":316.8999938964844,\"longitude\":16.3196549,\"latitude\":48.2414312},\"name\":\"location\",\"time\":1687242931275000000},{\"name\":\"barometer\",\"values\":{\"relativeAltitude\":0.4253997802734375,\"pressure\":986.10888671875},\"accuracy\":3,\"time\":1687242932118783000},{\"name\":\"orientation\",\"values\":{\"qz\":-0.9289849996566772,\"qy\":-0.3678100109100342,\"qx\":0.03742999956011772,\"qw\":0.017311999574303627,\"roll\":0.07802247256040573,\"pitch\":-0.7541589736938477,\"yaw\":3.1352388858795166},\"accuracy\":3,\"time\":1687242932238684700}]}"

    socket.on("sensorlogger", body => {
      // body is POSTed sensorlogger push data
      const msg = JSON.parse(body);
      // console.log('Body: ' + JSON.stringify(msg, null, 2));
      msg.payload.forEach(p => {
        const ts = new Date(p["time"] / 1000000);
        current_time = Cesium.JulianDate.fromDate(ts);
        stop_time = Cesium.JulianDate.addSeconds(
          current_time,
          10,
          new Cesium.JulianDate()
        );
        if (p.name == "orientation") {
          // if (hpr) {
          //   var hpRoll = new Cesium.HeadingPitchRoll(p.values.heading, p.values.pitch, p.values.roll);
          //   var orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpRoll);
          //  } else {
          //  }
          var orientation = new Cesium.Quaternion(p.values.qx, p.values.qy, p.values.qz, p.values.qw);
          var norm_orient = new Cesium.Quaternion();
          Cesium.Quaternion.normalize(orientation, norm_orient);

          orientationProperty.addSample(current_time, norm_orient);
          // Extend the life of the balloon object

          if (balloonEntity != null) {
            balloonEntity.availability = new Cesium.TimeIntervalCollection([
              new Cesium.TimeInterval({ start: start_time, stop: stop_time })
            ]);
            console.log("quaternion");
            viewer.clock.shouldAnimate = false;
            viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
            // viewer.clock.stopTime = stop_time.clone(); // update the stop time
            // viewer.timeline.zoomTo(current_time, stop_time);
          }
        }
        if (p.name == "location") {

          if (start_time == null) {
            start_time = current_time;
          }
          if (balloonEntity == null) {
            balloonEntity = viewer.entities.add({
              // add path for flight points we already know.
              availability: new Cesium.TimeIntervalCollection([
                new Cesium.TimeInterval({ start: start_time, stop: current_time })
              ]),
              position: positionProperty,
              // point: { pixelSize: 30, color: Cesium.Color.GREEN },
              model: { uri: "./CesiumBalloon.glb", maximumScale: 5000 },
              // model: { uri: balloonUri, maximumScale: 5000},
              orientation: orientationProperty,
              // orientation: new Cesium.VelocityOrientationProperty(positionProperty),
              path: new Cesium.PathGraphics({ width: 3 })
            });
            viewer.trackedEntity = balloonEntity;
            // Make the camera fly to the balloon.
            viewer.flyTo(balloonEntity);
          }
          const position = Cesium.Cartesian3.fromDegrees(
            p.values.longitude,
            p.values.latitude,
            p.values.altitude
          );
          positionProperty.addSample(current_time, position);

          // Extend the life of the balloon object
          balloonEntity.availability = new Cesium.TimeIntervalCollection([
            new Cesium.TimeInterval({ start: start_time, stop: stop_time })
          ]);
          viewer.clock.shouldAnimate = false;
          viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
          // viewer.timeline.zoomTo(current_time, stop_time);

          console.log("location");
        }
        // console.log(p);
      });
    });

    // New flight point received from the server
    socket.on("new_flight_point", new_flight_point => {
      //new_flight_point is JSON obj
      if (new_flight_point.height > 100000) new_flight_point.height = 0;
      current_time = Cesium.JulianDate.fromIso8601(new_flight_point.time);
      const position = Cesium.Cartesian3.fromDegrees(
        new_flight_point.longitude,
        new_flight_point.latitude,
        new_flight_point.height
      );
      // Store the position along with its timestamp.
      // var comment = new_flight_point.comment.slice(0,-16); // Edit if necessary for your specific mission
      // Add at run-time as samples are received from a server.
      positionProperty.addSample(current_time, position);
      // Plot it on the cesium app
      viewer.entities.add({
        description: `Location: (${new_flight_point.longitude}, ${new_flight_point.latitude}, ${new_flight_point.height})`,
        label: {
          text:
            "Time: " +
            current_time +
            "; Alt: " +
            Math.round(new_flight_point.height) +
            " m",
          font: "14pt monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -9),
          scaleByDistance: new Cesium.NearFarScalar(0, 1, 10000, 0.0)
        },
        position: position,
        point: { pixelSize: 10, color: Cesium.Color.RED }
      });
      if (balloonEntity != null) {
        // Where there are data already present in Cesium before new data is entered.
        var revd_pkt_stop_time = Cesium.JulianDate.addSeconds(
          current_time,
          1,
          new Cesium.JulianDate()
        ); // Required for stop_time > start_time
        if (Cesium.JulianDate.compare(revd_pkt_stop_time, stop_time) > 0) {
          stop_time = revd_pkt_stop_time.clone(); // Incase flight data is sent in the wrong order.
        }
        balloonEntity.position = positionProperty; // Update the path of the balloon object
        balloonEntity.orientation = new Cesium.VelocityOrientationProperty(
          positionProperty
        );
        // Extend the life of the balloon object
        balloonEntity.availability = new Cesium.TimeIntervalCollection([
          new Cesium.TimeInterval({ start: start_time, stop: stop_time })
        ]);
        // window.alert("New packet received! Teleporting you over!");
        viewer.clock.shouldAnimate = false;
      } else {
        // For fresh servers without any previous flight data. ie balloonEntity == null && start_time == null.
        stop_time = Cesium.JulianDate.addSeconds(
          current_time,
          1,
          new Cesium.JulianDate()
        ); // Required for stop_time > start_time
        viewer.clock.startTime = current_time.clone(); // define the start time
        viewer.timeline.zoomTo(current_time, stop_time); // in this special case, the current_time is also the start_time
        // A balloon object must be created.
        balloonEntity = viewer.entities.add({
          // add path for flight points we already know.
          availability: new Cesium.TimeIntervalCollection([
            new Cesium.TimeInterval({ start: start_time, stop: stop_time })
          ]),
          // model: { uri: balloonUri, maximumScale: 5000},
          orientation: new Cesium.VelocityOrientationProperty(positionProperty),
          position: positionProperty,
          // point: { pixelSize: 30, color: Cesium.Color.GREEN },
          model: { uri: "./CesiumBalloon.glb", maximumScale: 5000 },
          path: new Cesium.PathGraphics({ width: 3 })
        });
      }
      viewer.clock.currentTime = current_time.clone(); // update the clock displayed in the GUI
      viewer.clock.stopTime = stop_time.clone(); // update the stop time
      viewer.trackedEntity = undefined; // Untrack any objects to make the camera flight transition smooth
      /*viewer.flyTo(balloonEntity);*/ // Teleport the camera to the balloon
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
