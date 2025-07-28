<script setup>
import { provide, ref, watch, onMounted } from "vue";
import {
  ChartComponent as EjsChart,
  SeriesDirective as Series,
  SeriesCollectionDirective as SeriesCollection,
  ColumnSeries,
  Category,
  Tooltip,
  Legend
} from "@syncfusion/ej2-vue-charts";
import { getItem } from "../../actions/getItem";

const props = defineProps({
  selectedProject: String
});

const seriesData = ref([]);
const planData = ref([]);
const taskData = ref([]);
const isLoading = ref(true);

const primaryXAxis = {
  valueType: "Category",
  labelRotation: 0,
};

const primaryYAxis = {
  minimum: 0,
  maximum: 100,
  interval: 10,
};

const title = "PROJECT PHASE PROGRESS %";

// Load data on mount
onMounted(() => {
  const fields1 = ["ID", "Title", "assigned_to", "dependency", "start_date", "end_date", "deadline_date", "duration", "passed_days", "left_days", "timeline_progress", "status"];
  const fields2 = ["ID", "project_name", "phase", "task", "sub_task"];

  getItem("Plans", fields1).then(res => {
    planData.value = res;
  });
  getItem("Tasks", fields2).then(res => {
    taskData.value = res;
  });
  
  // Fallback timeout to hide loading if data doesn't load within 8 seconds
  setTimeout(() => {
    if (isLoading.value) {
      isLoading.value = false;
      console.warn('Chart loading timeout reached - hiding spinner');
    }
  }, 8000);
});

// Watch for selected project changes and data availability
watch([() => props.selectedProject, planData, taskData], ([project, plans, tasks]) => {
  if (project && plans.length > 0 && tasks.length > 0) {
    processPhaseProgress();
    isLoading.value = false;
  }
}, { deep: true });

// Function to process phase progress data (same as first table in PivotTable)
const processPhaseProgress = () => {
  const plans = planData.value;
  const tasks = taskData.value;
  
  // Create a mapping from task title to phase
  const taskToPhaseMap = {};
  tasks.forEach(task => {
    const taskKey = `${task.sub_task}`;
    taskToPhaseMap[taskKey] = task.phase;
  });

  // Group plans by phase
  const phaseGroups = {};
  
  plans.forEach(plan => {
    let phase;
    
    if (taskToPhaseMap[plan.Title]) {
      phase = taskToPhaseMap[plan.Title];

      if (!phaseGroups[phase]) {
        phaseGroups[phase] = [];
      }
      phaseGroups[phase].push(plan);
    }

  });

  // Calculate progress for each phase
  const phaseProgress = [];
  
  Object.entries(phaseGroups).forEach(([phase, plans]) => {
    if (plans.length > 0) {
      const validPlans = plans.filter(plan => plan.timeline_progress !== null && plan.timeline_progress !== undefined);
      
      if (validPlans.length > 0) {
        const totalProgress = validPlans.reduce((sum, plan) => {
          return sum + (parseFloat(plan.timeline_progress) || 0);
        }, 0);
        
        const averageProgress = totalProgress / validPlans.length;
        
        phaseProgress.push({
          phase: phase,
          progress: Math.round(averageProgress)
        });
      } else {
        // If no valid progress data, show 0
        phaseProgress.push({
          phase: phase,
          progress: 0
        });
      }
    }
  });

  // Sort by phase name for consistent display
  phaseProgress.sort((a, b) => a.phase.localeCompare(b.phase));
  
  // Transform data for chart format
  const chartData = phaseProgress.map(item => ({
    phase: item.phase,
    progress: item.progress
  }));
  
  seriesData.value = chartData;
};

provide("chart", [ColumnSeries, Category, Tooltip, Legend]);
</script>

<template>
  <div class="chart-container">
    <div v-if="isLoading" class="chart-loading">
      <q-spinner-dots size="40px" color="primary" />
      <div class="chart-loading-text">Loading phase progress...</div>
    </div>
    
    <EjsChart
      v-else
      ref="chart"
      :title="title"
      :primaryXAxis="primaryXAxis"
      :primaryYAxis="primaryYAxis"
      width="100%"
      height="400px"
    >
      <SeriesCollection>
        <Series
          :dataSource="seriesData"
          type="Column"
          xName="phase"
          yName="progress"
          name="Progress %"
        />
      </SeriesCollection>
    </EjsChart>
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
  min-width: 90%;
  height: 400px;
}

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

.e-series-0 rect {
  fill: #4472c4;
}
.e-series-1 rect {
  fill: #ed7d31;
}
</style>
