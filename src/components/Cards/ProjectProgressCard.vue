<template>
	<div>
		<ProjectProgressChart :selectedProject="selectedProject" />
	</div>

</template>

<script setup>
	import ProjectProgressChart from '../Charts/ProjectProgress.vue'

	const props = defineProps({
		selectedProject: String
	})

	defineExpose({})

</script>