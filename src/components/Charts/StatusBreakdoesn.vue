<template>
  <div class="control-section">
    <div align="center">
      <div v-if="isLoading" class="loading-message">
        <p>Loading status data...</p>
      </div>
      <div v-else-if="!hasData" class="no-data-message">
        <p>No status data available for the selected project.</p>
        <p>Please ensure the project has tasks with status information.</p>
      </div>
      <AccumulationChartComponent
        v-else
        style="display: block"
        :theme="theme"
        id="pie-border-container"
        :chartArea="chartArea"
        :pointRender="pointRender"
        :tooltip="tooltip"
        :enableBorderOnMouseMove="false"
        :enableAnimation="enableAnimation"
        :width="width"
        :height="height"
        :title="title"
        :legendSettings="legend"
      >
        <AccumulationSeriesCollectionDirective>
          <AccumulationSeriesDirective
            type="Pie"
            :dataSource="seriesData"
            xName="x"
            yName="y"
            name="Project"
            :radius="radius"
            startAngle="120"
            innerRadius="50%"
            :dataLabel="dataLabel"
            :border="border"
            :animation="animation"
            :borderRadius="borderRadius"
            :palettes="palette"
          ></AccumulationSeriesDirective>
        </AccumulationSeriesCollectionDirective>
      </AccumulationChartComponent>
    </div>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, watch, computed } from "vue";
import { Browser } from "@syncfusion/ej2-base";
import {
  AccumulationChartComponent,
  AccumulationSeriesCollectionDirective,
  AccumulationSeriesDirective,
  PieSeries,
  AccumulationTooltip,
  AccumulationDataLabel,
  AccumulationAnnotation,
} from "@syncfusion/ej2-vue-charts";
import { loadChartTheme, roundedCornnerPointRender } from "./theme-color";
import { getAllItems } from "../../actions/getAllItem";
import { getItem } from "../../actions/getItem";

const props = defineProps({
  selectedProject: String,
});

// Reactive data
const theme = ref(loadChartTheme());
const seriesData = ref([]);

const chartArea = ref({
  border: { width: 0 },
});

const dataLabel = ref({
  visible: true,
  position: "Outside",
  name: "text",
  font: { size: "12px", fontWeight: "600" },
  connectorStyle: { length: "20px", type: "Curve" },
});

const border = ref({ width: 0.5, color: "#ffffff" });
const borderRadius = ref(8);
const radius = ref(Browser.isDevice ? "30%" : "70%");
const animation = ref({ enable: true });

const tooltip = ref({
  enable: true,
  header: "",
  format: "<b>${point.x}</b><br>Tasks: <b>${point.y}</b>",
  enableHighlight: true,
});

const width = ref(Browser.isDevice ? "100%" : "90%");
const height = ref(Browser.isDevice ? "300px" : "500px");
const enableAnimation = ref(true);
const legend = ref({ visible: true, position: "bottom" });
const title = ref("STATUS BREAKDOWN");
const palette = ref([]);

const taskData = ref([]);
const projectData = ref([]);
const isLoading = ref(true);

const hasData = computed(() => {
  return seriesData.value.length > 0;
});

provide("accumulationchart", [PieSeries, AccumulationTooltip, AccumulationDataLabel, AccumulationAnnotation]);

onMounted(() => {
  const fields1 = ["ID", "project_name", "phase", "task", "sub_task", "assigned_to", "timeline_progress", "status"];
  getAllItems("Tasks", fields1).then((res) => {
    taskData.value = res;
  });

  const fields2 = ["ID", "Title", "phase", "members", "status"];
  getItem("Projects", fields2).then((res) => {
    projectData.value = res;
  });
});

watch(
  [() => props.selectedProject, taskData, projectData],
  ([project, tasks, projects]) => {
    if (project && tasks.length > 0 && projects.length > 0) {
      constructData(tasks.filter((item) => item.project_name == project));
      isLoading.value = false;
    }
  },
  { immediate: true, deep: true }
);

const constructData = (dataArray) => {
  if (!dataArray || dataArray.length === 0) {
    seriesData.value = [];
    return;
  }

  const currentProject = projectData.value.find((item) => item.Title == props.selectedProject);

  if (!currentProject || !currentProject.status) {
    seriesData.value = [];
    return;
  }

  const statusColors = {};
  try {
    currentProject.status.split(",").forEach((statusItem) => {
      if (statusItem && statusItem.includes("#")) {
        const [name, color] = statusItem.split("#");
        if (name && color) {
          statusColors[name.trim()] = "#" + color.trim();
        }
      }
    });
  } catch (error) {
    console.error("Error parsing status colors:", error);
  }

  // Count tasks by status
  const statusCounts = {};
  dataArray.forEach((task) => {
    const status = task.status || "Open";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Convert to chart data format
  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    x: status,
    y: count,
    text: `${status}: ${count}`,
  }));

  // Create palette colors array in the same order as the data
  const paletteColors = chartData.map((item) => statusColors[item.x] || "#666666");
  seriesData.value = chartData;

  updateChartPalette(paletteColors);
};

// Methods
const updateChartPalette = (colors) => {
  palette.value = colors;
};

const pointRender = (args) => {
  roundedCornnerPointRender(args);
};
</script>

<style scoped>
.loading-message,
.no-data-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.loading-message p,
.no-data-message p {
  margin: 8px 0;
}

.loading-message {
  color: #007bff;
  font-weight: 500;
}
</style>
