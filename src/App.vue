<template>
  <CesiumViewer></CesiumViewer>
</template>

<script>
import CesiumViewer from './components/CesiumViewer.vue'

export default {
  name: 'App',
  components: {
    CesiumViewer
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100%;
  width: 100%;
}
body {
   margin: 0;
   background-color: black;
}
</style>
