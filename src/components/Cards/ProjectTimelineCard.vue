<template>
	<div>
		<ProjectTimelineChart :selectedProject="selectedProject" />
	</div>

</template>

<script setup>
	import ProjectTimelineChart from '../Charts/ProjectTimeline.vue'

	const props = defineProps({
		selectedProject: String
	})

	defineExpose({})

</script>