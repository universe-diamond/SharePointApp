<script setup>
import { provide, ref, onMounted, watch } from "vue";
import { ChartComponent as EjsChart, SeriesCollectionDirective as ESeriesCollection, SeriesDirective as ESeries, StackingColumnSeries, Category, Legend } from "@syncfusion/ej2-vue-charts";
import { getItem } from "../../actions/getItem";

const props = defineProps({
  selectedProject: {
    type: String,
    default: null
  }
});

const planData = ref([]);
const isLoading = ref(true);

const statusList = [
  { name: "NOT STARTED", color: "#808080" },
  { name: "PENDING", color: "#FF6B6B" },
  { name: "DELAYED", color: "#FFD93D" },
  { name: "ON GOING", color: "#4ECDC4" },
  { name: "COMPLETED", color: "#6BCF7F" }
];

const memberWorkloadData = ref([]);

const getSeries = () => {
  if (!memberWorkloadData.value.length) return [];
  
  return statusList.map(status => ({
    dataSource: memberWorkloadData.value.map(member => ({
      x: member.member,
      y: getStatusCount(member, status.name)
    })),
    xName: 'x',
    yName: 'y',
    name: status.name,
    type: 'StackingColumn',
    fill: status.color
  }));
};

const getStatusCount = (member, statusName) => {
  switch (statusName) {
    case "COMPLETED":
      return member.completed || 0;
    case "ON GOING":
      return member.ongoing || 0;
    case "DELAYED":
      return member.delayed || 0;
    case "PENDING":
      return member.pending || 0;
    case "NOT STARTED":
      return member.notStarted || 0;
    default:
      return 0;
  }
};

const processMemberWorkload = () => {
  const plans = planData.value;
  
  // Filter by selected project if provided
  const filteredPlans = props.selectedProject 
    ? plans.filter(plan => plan.project_name === props.selectedProject)
    : plans;
  
  const targetStatuses = ['completed', 'notstarted', 'delayed', 'inprogress', 'roadblock'];
  
  const memberGroups = {};
  const foundMembers = new Set();
  
  filteredPlans.forEach(plan => {
    // Skip plans without assigned members
    if (!plan.assigned_to) return;
    
    const member = plan.assigned_to;
    foundMembers.add(member);
    const status = plan.status || 'notstarted';
    
    if (!memberGroups[member]) {
      memberGroups[member] = {
        member: member,
        completed: 0,
        ongoing: 0,
        delayed: 0,
        pending: 0,
        notStarted: 0
      };
    }
    
    // Map status to the correct field
    switch (status) {
      case 'completed':
        memberGroups[member].completed++;
        break;
      case 'inprogress':
        memberGroups[member].ongoing++;
        break;
      case 'delayed':
        memberGroups[member].delayed++;
        break;
      case 'roadblock':
        memberGroups[member].pending++;
        break;
      case 'notstarted':
      default:
        memberGroups[member].notStarted++;
        break;
    }
  });
  
  // Convert to array and sort by member name
  const memberWorkload = Object.values(memberGroups).sort((a, b) => 
    a.member.localeCompare(b.member)
  );
  
  memberWorkloadData.value = memberWorkload;
  isLoading.value = false;
};

const primaryXAxis = {
  title: 'Members',
  valueType: 'Category',
  labelIntersectAction: 'Rotate45',
  labelRotation: 45
};

const primaryYAxis = {
  title: 'Tasks',
  minimum: 0,
  interval: 10
};

const title = 'MEMBERS WORKLOAD';

// Watch for selected project changes
watch(() => props.selectedProject, () => {
  if (planData.value.length > 0) {
    processMemberWorkload();
  }
});

// Watch for plan data changes
watch(planData, () => {
  if (planData.value.length > 0) {
    processMemberWorkload();
  }
}, { deep: true });

onMounted(() => {
  const fields = [
    "ID", 
    "Title", 
    "assigned_to", 
    "dependency", 
    "start_date", 
    "end_date", 
    "deadline_date", 
    "duration", 
    "passed_days", 
    "left_days", 
    "timeline_progress", 
    "status",
    "project_name"
  ];
  
  getItem("Plans", fields).then(res => {
    planData.value = res;
  }).catch(error => {
    console.error('Error fetching plan data:', error);
    isLoading.value = false;
  });
});

provide('chart', [StackingColumnSeries, Category, Legend]);
</script>

<template>
  <div>
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading member workload data...</div>
    </div>
    <div v-else-if="memberWorkloadData.length === 0" class="no-data">
      <div class="no-data-text">No member workload data available</div>
    </div>
    <ejs-chart 
      v-else
      style="height: 600px;" 
      :title='title' 
      :primaryXAxis='primaryXAxis' 
      :primaryYAxis='primaryYAxis' 
      :legendSettings="{ visible: true }"
    >
      <e-series-collection>
        <e-series
          v-for="series in getSeries()"
          :key="series.name"
          v-bind="series"
        />
      </e-series-collection>
    </ejs-chart>
  </div>
</template>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 600px;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-text {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 600px;
  text-align: center;
}

.no-data-text {
  font-size: 16px;
  color: #999;
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>