<script setup>
import { provide, ref, onMounted, watch } from "vue";
import {
  ChartComponent as EjsChart,
  SeriesCollectionDirective as ESeriesCollection,
  SeriesDirective as ESeries,
  StackingColumnSeries,
  Category,
  Legend,
} from "@syncfusion/ej2-vue-charts";
import { getItem } from "../../actions/getItem";

const props = defineProps({
  selectedProject: {
    type: String,
    default: null,
  },
  memberList: Array,
  statusList: Array,
});

const tasksData = ref([]);
const isLoading = ref(true);

const memberWorkloadData = ref([]);

const getSeries = () => {
  if (!memberWorkloadData.value.length) return [];

  return props.statusList.map((status) => ({
    dataSource: memberWorkloadData.value.map((member) => ({
      x: member.member,
      y: member[status.name],
    })),
    xName: "x",
    yName: "y",
    name: status.name,
    type: "StackingColumn",
    fill: status.color,
  }));
};

const processMemberWorkload = () => {
  const tasks = tasksData.value;

  // Filter by selected project if provided
  const filteredTasks = props.selectedProject
    ? tasks.filter((task) => task.project_name === props.selectedProject)
    : tasks;
  console.log({
    filteredTasks,
    a: props.selectedProject,
  });

  const memberGroups = {};

  props.memberList.forEach((member) => {
    memberGroups[member] = { member };
  });

  filteredTasks.forEach((task) => {
    // Skip tasks without assigned members
    if (!task.assigned_to) return;

    const member = task.assigned_to;
    const status = task.status || "Open";

    // Map status to the correct field
    if (memberGroups[member][status]) memberGroups[member][status]++;
    else memberGroups[member][status] = 1;
  });

  // Convert to array and sort by member name
  const memberWorkload = Object.values(memberGroups).sort((a, b) => a.member.localeCompare(b.member));

  memberWorkloadData.value = memberWorkload;
  isLoading.value = false;
};

const primaryXAxis = {
  title: "Members",
  valueType: "Category",
  labelIntersectAction: "Rotate45",
  labelRotation: 45,
};

const primaryYAxis = {
  title: "Tasks",
  minimum: 0,
  interval: 10,
};

const title = "MEMBERS WORKLOAD";

// Watch for selected project changes
watch(
  () => props.selectedProject,
  () => {
    if (tasksData.value.length > 0) {
      processMemberWorkload();
    }
  }
);

// Watch for plan data changes
watch(
  tasksData,
  () => {
    if (tasksData.value.length > 0) {
      processMemberWorkload();
    }
  },
  { deep: true, immediate: true }
);

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
    "project_name",
  ];

  getItem("Tasks", fields)
    .then((res) => {
      tasksData.value = res;
    })
    .catch((error) => {
      console.error("Error fetching plan data:", error);
      isLoading.value = false;
    });
});

provide("chart", [StackingColumnSeries, Category, Legend]);
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
      style="height: 600px"
      :title="title"
      :primaryXAxis="primaryXAxis"
      :primaryYAxis="primaryYAxis"
      :legendSettings="{ visible: true }"
    >
      <e-series-collection>
        <e-series v-for="series in getSeries()" :key="series.name" v-bind="series" />
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
