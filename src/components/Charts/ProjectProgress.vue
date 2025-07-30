<script setup>
import { provide, ref, watch, onMounted } from "vue";
import {
  ChartComponent as EjsChart,
  SeriesCollectionDirective as ESeriesCollection,
  SeriesDirective as ESeries,
  StackingColumnSeries,
  Category,
  Legend,
  DataLabel,
} from "@syncfusion/ej2-vue-charts";
import { getItem } from "../../actions/getItem";
import { getAllItems } from "../../actions/getAllItem";

const props = defineProps({
  selectedProject: String,
});

const seriesData = ref([]);
const taskData = ref([]);
const isLoading = ref(true);

const primaryXAxis = {
  title: "",
  valueType: "Category",
};
const primaryYAxis = {
  title: "",
  minimum: 0,
  maximum: 300,
  interval: 50,
};
const title = "PROJECT PROGRESS IN DAYS";
const legendSettings = { visible: true };
const markerSettingsLeft = {
  dataLabel: {
    visible: true,
    position: "Middle",
    font: { color: "#fff", fontWeight: "bold" },
  },
};
const markerSettingsPassed = {
  dataLabel: {
    visible: true,
    position: "Middle",
    font: { color: "#fff", fontWeight: "bold" },
  },
};

onMounted(() => {
  const fields = [
    "ID",
    "project_name",
    "phase",
    "task",
    "sub_task",
    "assigned_to",
    "dependency",
    "start_date",
    "deadline_date",
    "duration",
    "passed_days",
    "left_days",
    "timeline_progress",
    "status",
  ];
  getAllItems("Tasks", fields).then((res) => {
    taskData.value = res;
  });

  setTimeout(() => {
    if (isLoading.value) {
      isLoading.value = false;
      console.warn("Chart loading timeout reached - hiding spinner");
    }
  }, 8000);
});

watch(
  [() => props.selectedProject, taskData],
  ([project, tasks]) => {
    if (project && tasks.length > 0) {
      processProjectTimeline(tasks.filter((item) => item.project_name == project));
      isLoading.value = false;
    }
  },
  { immediate: true, deep: true }
);

// Function to process project timeline data
const processProjectTimeline = (taskArray) => {
  const tasks = taskArray;

  const taskToPhaseMap = {};
  tasks.forEach((task) => {
    const taskKey = `${task.sub_task}`;
    taskToPhaseMap[taskKey] = task.phase;
  });

  const phaseGroups = {};

  tasks.forEach((task) => {
    let phase;

    if (taskToPhaseMap[task.sub_task]) {
      phase = taskToPhaseMap[task.sub_task];
      if (!phaseGroups[phase]) {
        phaseGroups[phase] = [];
      }
      phaseGroups[phase].push(task);
    }
  });

  // Calculate timeline for each phase
  const phaseTimeline = [];
  const today = new Date();

  Object.entries(phaseGroups).forEach(([phase, tasks]) => {
    if (tasks.length > 0) {
      const validPlans = tasks.filter((task) => task.start_date && task.deadline_date);

      if (validPlans.length > 0) {
        const startDates = validPlans
          .map((task) => {
            const date = new Date(task.start_date);
            return isNaN(date.getTime()) ? null : date;
          })
          .filter((date) => date !== null);
        const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;

        const endDates = validPlans
          .map((task) => {
            const date = new Date(task.deadline_date);
            return isNaN(date.getTime()) ? null : date;
          })
          .filter((date) => date !== null);
        const latestEnd = endDates.length > 0 ? new Date(Math.max(...endDates)) : null;

        let daysPassed = 0;
        let daysLeft = 0;

        if (earliestStart) {
          const daysDiff = Math.floor((today - earliestStart) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0) {
            daysPassed = daysDiff;
          }
        }

        if (latestEnd) {
          const daysDiff = Math.floor((latestEnd - today) / (1000 * 60 * 60 * 24));
          if (daysDiff > 0) {
            daysLeft = daysDiff;
          }
        }

        phaseTimeline.push({
          project: phase,
          daysPassed: daysPassed,
          daysLeft: daysLeft,
        });
      } else {
        phaseTimeline.push({
          project: phase,
          daysPassed: 0,
          daysLeft: 0,
        });
      }
    }
  });

  phaseTimeline.sort((a, b) => a.project.localeCompare(b.project));

  seriesData.value = phaseTimeline;
};

provide("chart", [StackingColumnSeries, Category, Legend, DataLabel]);
</script>

<template>
  <div>
    <div v-if="isLoading" class="chart-loading">
      <q-spinner-dots size="40px" color="primary" />
      <div class="chart-loading-text">Loading project progress...</div>
    </div>

    <ejs-chart
      v-else
      style="height: 400px"
      :title="title"
      :primaryXAxis="primaryXAxis"
      :primaryYAxis="primaryYAxis"
      :legendSettings="legendSettings"
    >
      <e-series-collection>
        <e-series
          :dataSource="seriesData"
          type="StackingColumn"
          xName="project"
          yName="daysPassed"
          name="DAYS PASSED"
          :marker="markerSettingsPassed"
          fill="#F79646"
        />
        <e-series
          :dataSource="seriesData"
          type="StackingColumn"
          xName="project"
          yName="daysLeft"
          name="DAYS LEFT"
          :marker="markerSettingsLeft"
          fill="#4F81BD"
        />
      </e-series-collection>
    </ejs-chart>
  </div>
</template>

<style scoped>
.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  text-align: center;
}
.chart-loading-text {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}
</style>
