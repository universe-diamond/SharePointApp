<script setup>
import { provide, ref, watch, onMounted } from "vue";
import { ChartComponent as EjsChart, SeriesCollectionDirective as ESeriesCollection, SeriesDirective as ESeries, StackingColumnSeries, Category, Legend, DataLabel } from "@syncfusion/ej2-vue-charts";
import { getItem } from "../../actions/getItem";

const props = defineProps({
  selectedProject: String
});

const seriesData = ref([]);
const planData = ref([]);
const taskData = ref([]);
const isLoading = ref(true);

const primaryXAxis = {
  title: '',
  valueType: 'Category',
};
const primaryYAxis = {
  title: '',
  minimum: 0,
  maximum: 300,
  interval: 50,
};
const title = 'PROJECT PROGRESS IN DAYS';
const legendSettings = { visible: true };
const markerSettingsLeft = {
  dataLabel: {
    visible: true,
    position: 'Middle',
    font: { color: '#fff', fontWeight: 'bold' }
  }
};
const markerSettingsPassed = {
  dataLabel: {
    visible: true,
    position: 'Middle',
    font: { color: '#fff', fontWeight: 'bold' }
  }
};

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
    processProjectTimeline();
    isLoading.value = false;
  }
}, { deep: true });

// Function to process project timeline data
const processProjectTimeline = () => {
  const plans = planData.value;
  const tasks = taskData.value;
  const selectedProject = props.selectedProject;
  
  const taskToPhaseMap = {};
  tasks.forEach(task => {
    const taskKey = `${task.sub_task}`;
    taskToPhaseMap[taskKey] = task.phase;
  });

  const phaseGroups = {};
  
  plans.forEach(plan => {

    let phase;

    if(taskToPhaseMap[plan.Title]) {

      phase = taskToPhaseMap[plan.Title];
      if (!phaseGroups[phase]) {
        phaseGroups[phase] = [];
      }
      phaseGroups[phase].push(plan);
    }

  });

  // Calculate timeline for each phase
  const phaseTimeline = [];
  const today = new Date();
  
  Object.entries(phaseGroups).forEach(([phase, plans]) => {
    if (plans.length > 0) {
      const validPlans = plans.filter(plan => plan.start_date && plan.deadline_date);
      
      if (validPlans.length > 0) {
        const startDates = validPlans.map(plan => {
          const date = new Date(plan.start_date);
          return isNaN(date.getTime()) ? null : date;
        }).filter(date => date !== null);
        const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;
        
        const endDates = validPlans.map(plan => {
          const date = new Date(plan.deadline_date);
          return isNaN(date.getTime()) ? null : date;
        }).filter(date => date !== null);
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
          daysLeft: daysLeft
        });
      }
    }
  });
  
  phaseTimeline.sort((a, b) => a.project.localeCompare(b.project));
  
  seriesData.value = phaseTimeline;
};

provide('chart', [StackingColumnSeries, Category, Legend, DataLabel]);

</script>

<template>
  <div>
    <div v-if="isLoading" class="chart-loading">
      <q-spinner-dots size="40px" color="primary" />
      <div class="chart-loading-text">Loading project progress...</div>
    </div>
    
    <ejs-chart v-else style="height: 400px;" :title='title' :primaryXAxis='primaryXAxis' :primaryYAxis='primaryYAxis' :legendSettings='legendSettings'>
      <e-series-collection>
        <e-series 
          :dataSource='seriesData' 
          type='StackingColumn' 
          xName='project' 
          yName='daysPassed' 
          name='DAYS PASSED' 
          :marker='markerSettingsPassed'
          fill="#F79646"
        />
        <e-series 
          :dataSource='seriesData' 
          type='StackingColumn' 
          xName='project' 
          yName='daysLeft'
          name='DAYS LEFT' 
          :marker='markerSettingsLeft'
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