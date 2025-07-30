<template>
  <div>
    <StatusBreakdoesnChart :selectedProject="selectedProject" />
  </div>
</template>

<script setup>
import StatusBreakdoesnChart from "../Charts/StatusBreakdoesn.vue";

const props = defineProps({
  selectedProject: String,
});

defineExpose({});
</script>
