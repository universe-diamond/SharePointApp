<script setup>
import MemberWorkloadChart from "../Charts/MemberWorkload.vue";

const props = defineProps({
  selectedProject: String,
  member: Array,
  status: Array,
});
</script>

<template>
  <div style="min-height: 625px">
    <MemberWorkloadChart :selectedProject="selectedProject" :memberList="member" :statusList="status" />
  </div>
</template>
