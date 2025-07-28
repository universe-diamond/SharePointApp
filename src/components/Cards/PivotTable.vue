<script setup>
  import { onMounted, ref, watch } from 'vue';
  import { getItem } from '../../actions/getItem';

  const planData = ref([]);
  const taskData = ref([]);
  const projectData = ref([]);
  const pivotData1Q = ref([]);
  const pivotData2Q = ref([]);
  const pivotData3Q = ref([]);
  const pivotData4Q = ref([]);
  const isLoading = ref(true);
  const tableLoading = ref({
    table1: true,
    table2: true,
    table3: true,
    table4: true
  });

  onMounted(() => {
    const fields1 = ["ID", "Title", "assigned_to", "dependency", "start_date", "end_date", "deadline_date", "duration", "passed_days", "left_days", "timeline_progress", "status"];
    const fields2 = ["ID", "project_name", "phase", "task", "sub_task"];
    const fields3 = ["ID", "Title", "Phases", "members", "status"]
    getItem("Plans", fields1).then(res => {
      planData.value = res;
    })
    getItem("Tasks", fields2).then(res => {
      taskData.value = res;
    })
    getItem("Projects", fields3).then(res => {
      projectData.value = res;
    })
    
    // Fallback timeout to hide loading if data doesn't load within 10 seconds
    setTimeout(() => {
      if (isLoading.value) {
        isLoading.value = false;
        console.warn('Loading timeout reached - hiding spinner');
      }
    }, 10000);
  })

  // Watch for data changes and process when both datasets are available
  watch([planData, taskData], ([plans, tasks]) => {
    if (plans.length > 0 && tasks.length > 0) {
      processPhaseProgress();
      processProjectProgress();
      processStatusCounts();
      processMemberWorkload();
      isLoading.value = false;
    }
  }, { deep: true });

  const processPhaseProgress = () => {
    const plans = planData.value;
    const tasks = taskData.value;
    
    const taskToPhaseMap = {};
    tasks.forEach(task => {
      const taskKey = `${task.sub_task}`;
      taskToPhaseMap[taskKey] = task.phase;
    });

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
    
    pivotData1Q.value = phaseProgress;
    tableLoading.value.table1 = false;
  };

  // Function to process phase timeline data for second table
  const processProjectProgress = () => {
    const plans = planData.value;
    const tasks = taskData.value;
    
    // Create a mapping from task title to phase (same as in processPhaseProgress)
    const taskToPhaseMap = {};
    tasks.forEach(task => {
      const taskKey = `${task.sub_task}`;
      taskToPhaseMap[taskKey] = task.phase;
    });

    // Group plans by phase
    const phaseGroups = {};
    
    plans.forEach(plan => {
      let phase;
      
      // Try exact match first
      if (taskToPhaseMap[plan.Title]) {
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
        // Find earliest start date and latest end date for this phase
        const validPlans = plans.filter(plan => plan.start_date && plan.deadline_date);
        
        if (validPlans.length > 0) {
          // Find earliest start date
          const startDates = validPlans.map(plan => {
            const date = new Date(plan.start_date);
            return isNaN(date.getTime()) ? null : date;
          }).filter(date => date !== null);
          const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates)) : null;
          
          // Find latest end date
          const endDates = validPlans.map(plan => {
            const date = new Date(plan.deadline_date);
            return isNaN(date.getTime()) ? null : date;
          }).filter(date => date !== null);
          const latestEnd = endDates.length > 0 ? new Date(Math.max(...endDates)) : null;
          
          let daysPassed = 'NOT STARTED';
          let daysLeft = 'DONE';
          
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
            phase: phase,
            daysPassed: daysPassed,
            daysLeft: daysLeft
          });
        } else {
          // No valid dates found
          phaseTimeline.push({
            phase: phase,
            daysPassed: 'NOT STARTED',
            daysLeft: 'DONE'
          });
        }
      }
    });
    
    // Sort by phase name for consistent display
    phaseTimeline.sort((a, b) => a.phase.localeCompare(b.phase));
    
    pivotData2Q.value = phaseTimeline;
    tableLoading.value.table2 = false;
  };

  // Function to process status counts for third table
  const processStatusCounts = () => {
    const plans = planData.value;
    
    // Define the five statuses we want to track
    const targetStatuses = ['completed', 'notstarted', 'delayed', 'inprogress', 'roadblock'];
    
    // Initialize counts for all target statuses
    const statusCounts = {};
    targetStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count statuses from plans data
    const foundStatuses = new Set();
    plans.forEach(plan => {
      const status = plan.status || 'notstarted'; // Default to notstarted if no status
      foundStatuses.add(status);
      
      // Check if the status matches any of our target statuses
      if (targetStatuses.includes(status)) {
        statusCounts[status]++;
      } else {
        // If status doesn't match our targets, count as 'notstarted'
        statusCounts['notstarted']++;
      }
    });
    
    const statusLabels = {
      'completed': 'COMPLETED',
      'notstarted': 'NOT STARTED', 
      'delayed': 'DELAYED',
      'inprogress': 'ON GOING',
      'roadblock': 'PENDING'
    };
    
    const statusData = targetStatuses.map(status => ({
      status: statusLabels[status],
      count: statusCounts[status]
    }));
    
    pivotData3Q.value = statusData;
    tableLoading.value.table3 = false;
  };

  // Function to process member workload for fourth table
  const processMemberWorkload = () => {
    const plans = planData.value;
    
    const targetStatuses = ['completed', 'notstarted', 'delayed', 'inprogress', 'roadblock'];
    
    const memberGroups = {};
    const foundMembers = new Set();
    
    plans.forEach(plan => {
      const member = plan.assigned_to || 'Unassigned';
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
    
    pivotData4Q.value = memberWorkload;
    tableLoading.value.table4 = false;
  };

  const pivotColumns1Q = [
    { name: "phase", label: "PHASE", field: "phase", align: "left" },
    { name: "progress", label: "PROGRESS %", field: "progress", align: "left" },
  ];

  const pivotColumns2Q = [
    { name: "phase", label: "PHASE", field: "phase", align: "left" },
    { name: "daysPassed", label: "DAYS PASSED", field: "daysPassed", align: "left" },
    { name: "daysLeft", label: "DAYS LEFT", field: "daysLeft", align: "left" },
  ];

  const pivotColumns3Q = [
    { name: "status", label: "STATUS", field: "status", align: "left" },
    { name: "count", label: "COUNT", field: "count", align: "left" },
  ];

  const pivotColumns4Q = [
    { name: "member", label: "MEMBER", field: "member", align: "left" },
    { name: "completed", label: "COMPLETED", field: "completed", align: "left" },
    { name: "ongoing", label: "ON GOING", field: "ongoing", align: "left" },
    { name: "delayed", label: "DELAYED", field: "delayed", align: "left" },
    { name: "pending", label: "PENDING", field: "pending", align: "left" },
    { name: "notStarted", label: "NOT STARTED", field: "notStarted", align: "left" },
  ];
</script>

<template>
  <div class="pivot-section">
    <div class="pivot-header">PIVOT TABLES</div>
    
    <!-- Loading Spinner -->
    <div v-if="isLoading" class="loading-container">
      <q-spinner-dots size="50px" color="primary" />
      <div class="loading-text">Loading project data...</div>
    </div>
    
    <!-- Tables Content -->
    <div v-else>
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Project Phase Progress %</div>
            <div v-if="tableLoading.table1" class="table-loading">
              <q-spinner-dots size="30px" color="primary" />
              <div class="table-loading-text">Loading phase progress...</div>
            </div>
            <q-table
              v-else
              :columns="pivotColumns1Q"
              :rows="pivotData1Q"
              dense
              flat
              :pagination="{rowsPerPage: 0}"
              bordered
              style="flex: 1; overflow: auto"
            >
              <template v-slot:bottom>
                <div style="text-align: center">
                  There are {{ pivotData1Q.length }} items.
                </div>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Project Phase Timeline</div>
            <div v-if="tableLoading.table2" class="table-loading">
              <q-spinner-dots size="30px" color="primary" />
              <div class="table-loading-text">Loading phase timeline...</div>
            </div>
            <q-table
              v-else
              :columns="pivotColumns2Q"
              :rows="pivotData2Q"
              dense
              flat
              :pagination="{rowsPerPage: 0}"
              bordered
              style="flex: 1; overflow: auto"
            >
              <template v-slot:bottom>
                <div style="text-align: center">
                  There are {{ pivotData2Q.length }} items.
                </div>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Project Task Status Distribution</div>
            <div v-if="tableLoading.table3" class="table-loading">
              <q-spinner-dots size="30px" color="primary" />
              <div class="table-loading-text">Loading status distribution...</div>
            </div>
            <q-table
              v-else
              :columns="pivotColumns3Q"
              :rows="pivotData3Q"
              dense
              flat
              :pagination="{rowsPerPage: 0}"
              bordered
              style="flex: 1; overflow: auto"
            >
              <template v-slot:bottom>
                <div style="text-align: center">
                  There are {{ pivotData3Q.length }} items.
                </div>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>
    </div>
    <div class="row q-col-gutter-md">
      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Project Member Task Status</div>
            <div v-if="tableLoading.table4" class="table-loading">
              <q-spinner-dots size="30px" color="primary" />
              <div class="table-loading-text">Loading member workload...</div>
            </div>
            <q-table
              v-else
              :columns="pivotColumns4Q"
              :rows="pivotData4Q"
              dense
              flat
              :pagination="{rowsPerPage: 0}"
              bordered
              style="flex: 1; overflow: auto"
            >
              <template v-slot:bottom>
                <div style="text-align: center">
                  There are {{ pivotData4Q.length }} items.
                </div>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
  .pivot-section {
  margin-top: 32px;
}
.pivot-header {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 16px;
  letter-spacing: 1px;
}
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}
.loading-text {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}
.table-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}
.table-loading-text {
  margin-top: 12px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
}
</style>