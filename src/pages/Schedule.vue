<script setup>
import { ref, computed, watch, onMounted } from "vue";
import LoadingSpinner from "../components/LoadingSpinner.vue";
import { useScheduleStore } from "../store";
import { getItem } from "../actions/getItem";
import { getAllItems } from "../actions/getAllItem";

const scheduleStore = useScheduleStore();

const loading = ref(true);

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const selectedYear = ref(currentYear);
const selectedMonth = ref(new Date().getMonth());
const selectedWeek = ref();

const selectedProject = ref("");
const availableStatus = ref({});

const tableRows = ref([]);

const projectOptions = ref([]);

onMounted(async () => {
  scheduleStore.setLoading(true);
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
  await getAllItems("Tasks", fields).then((res) => {
    scheduleStore.setTotal(res);
  });

  const fields1 = ["ID", "Title", "phases", "members", "status", "key_IDs", "months", "years", "note_types"];

  projectOptions.value = await getItem("Projects", fields1);

  scheduleStore.setLoading(false);
  resetTableRows();
});

watch(
  [selectedProject, projectOptions],
  ([selectedProject, projectOptions]) => {
    scheduleStore.setSelectedProject(selectedProject);

    // Save the status of the selected project as availableStatus
    if (selectedProject) {
      const project = Object.values(projectOptions).find((it) => it.Title == selectedProject);

      availableStatus.value = {};
      (project ? (project.status ? project.status : "") : "").split(",").forEach((it) => {
        const [name, color] = it.split("#");
        availableStatus.value[name] = "#" + color;
      });
    } else {
      availableStatus.value = {};
    }
  },
  { deep: true, immediate: true }
);

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getWeeksInMonth(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const weeks = [];
  let weekStart = 1;
  let weekEnd = 7 - (new Date(year, month, 1).getDay() - 1);
  if (weekEnd <= 0) weekEnd = 1;
  while (weekStart <= daysInMonth) {
    weekEnd = Math.min(weekEnd, daysInMonth);
    weeks.push({
      label: `Week ${weeks.length + 1} (${weekStart}-${weekEnd})`,
      start: weekStart,
      end: weekEnd,
    });
    weekStart = weekEnd + 1;
    weekEnd = weekStart + 6;
  }

  return weeks;
}

const weeksInMonth = computed(() => getWeeksInMonth(selectedYear.value, selectedMonth.value));

function getCurrentWeekIndex(weeks, year, month) {
  const today = new Date();
  if (today.getFullYear() !== year || today.getMonth() !== month) return 0;
  const day = today.getDate();
  return weeks.findIndex((w) => day >= w.start && day <= w.end);
}

watch(
  [selectedYear, selectedMonth],
  ([year, month]) => {
    const weeks = getWeeksInMonth(year, month);
    const idx = getCurrentWeekIndex(weeks, year, month);
    selectedWeek.value = idx !== -1 ? idx : 0;
  },
  { immediate: true }
);

async function resetTableRows() {
  loading.value = true;
  const week = weeksInMonth.value[selectedWeek.value];
  const days = [];
  for (let d = week.start; d <= week.end; d++) {
    const date = new Date(selectedYear.value, selectedMonth.value, d);
    const existTasks = scheduleStore.scheduleData.find((item) => item.date == date.toISOString().slice(0, 10));
    days.push({
      label: date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      date: date.toISOString().slice(0, 10),
      tasks: existTasks
        ? existTasks.taskIds.map((taskID) => scheduleStore.total.find((it) => it.ID == taskID).task)
        : [],
    });
  }
  tableRows.value = days;
  await new Promise((resolve) => setTimeout(resolve, 500));
  loading.value = false;
}

watch([selectedYear, selectedMonth, selectedWeek], resetTableRows);

function removeTask(rowIdx, tIdx) {
  tableRows.value[rowIdx].tasks.splice(tIdx, 1);
}

function getAvailableTasksForDay(date) {
  if (!scheduleStore.selectedProject) {
    return [];
  }

  const targetDate = new Date(date);

  return scheduleStore.total.filter((taskObject) => {
    // Check if task belongs to selected project
    if (taskObject.project_name !== scheduleStore.selectedProject) {
      return false;
    }

    if (!taskObject.start_date || !taskObject.duration) {
      return false;
    }

    const startDate = new Date(taskObject.start_date);
    const duration = parseInt(taskObject.duration) || 0;

    // Calculate end date by adding duration to start date
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration);

    // Check if the target date falls within the task's timeline
    return targetDate >= startDate && targetDate <= endDate;
  });
}

function isCurrent(label) {
  const today = new Date();
  const labelDate = label.match(/\d+/g);
  if (!labelDate) return false;
  const dayNum = parseInt(labelDate[labelDate.length - 1]);
  return (
    selectedYear.value === today.getFullYear() && selectedMonth.value === today.getMonth() && dayNum === today.getDate()
  );
}

function getStatusName(statusString) {
  if (!statusString) return "";
  // Extract status name from format "StatusName#ColorCode"
  const match = statusString.match(/^([^#]+)/);
  return match ? match[1].trim() : "";
}

function getStatusColor(statusString) {
  return availableStatus.value[statusString] || "#666";
}

// Get all unique statuses for the selected project
function getProjectStatuses() {
  if (!scheduleStore.selectedProject) return [];

  const projectTasks = scheduleStore.total.filter((task) => task.project_name === scheduleStore.selectedProject);

  const statuses = projectTasks
    .map((task) => task.status)
    .filter((status) => status) // Remove empty/null statuses
    .filter((status, index, arr) => arr.indexOf(status) === index); // Remove duplicates

  return statuses;
}

// Get status summary for the selected project
function getProjectStatusSummary() {
  if (!scheduleStore.selectedProject) return {};

  const projectTasks = scheduleStore.total.filter((task) => task.project_name === scheduleStore.selectedProject);

  const statusCount = {};
  projectTasks.forEach((task) => {
    if (task.status) {
      const statusName = getStatusName(task.status);
      statusCount[statusName] = (statusCount[statusName] || 0) + 1;
    }
  });

  return statusCount;
}

function prevWeek() {
  if (selectedWeek.value > 0) {
    selectedWeek.value--;
  } else {
    // Go to previous month
    if (selectedMonth.value > 0) {
      selectedMonth.value--;
    } else if (selectedYear.value > years[0]) {
      selectedYear.value--;
      selectedMonth.value = 11;
    } else {
      // Already at the earliest year/month
      return;
    }
    // Set to last week of new month
    selectedWeek.value = weeksInMonth.value.length - 1;
  }
}
function nextWeek() {
  if (selectedWeek.value < weeksInMonth.value.length - 1) {
    selectedWeek.value++;
  } else {
    // Go to next month
    if (selectedMonth.value < 11) {
      selectedMonth.value++;
    } else if (selectedYear.value < years[years.length - 1]) {
      selectedYear.value++;
      selectedMonth.value = 0;
    } else {
      // Already at the latest year/month
      return;
    }
    // Set to first week of new month
    selectedWeek.value = 0;
  }
}
</script>

<template>
  <q-card class="schedule-root">
    <LoadingSpinner :showing="loading" text="Loading schedule...">
      <div>
        <div class="schedule-header">
          <div class="schedule-project-selects">
            <select v-model="selectedProject" class="selectbox" :class="{ 'no-project-selected': !selectedProject }">
              <option value="" disabled>Select project</option>
              <option v-for="proj in projectOptions" :key="proj" :value="proj.Title">
                {{ proj.Title }}
              </option>
            </select>
          </div>
          <div class="schedule-selects">
            <select v-model="selectedYear" class="selectbox">
              <option v-for="year in years" :key="year" :value="year">
                {{ year }}
              </option>
            </select>
            <select v-model="selectedMonth" class="selectbox">
              <option v-for="(month, idx) in months" :key="month" :value="idx">
                {{ month }}
              </option>
            </select>
            <select v-model="selectedWeek" class="selectbox">
              <option v-for="(week, idx) in weeksInMonth" :key="week.label" :value="idx">
                {{ week.label }}
              </option>
            </select>
            <q-btn class="glossy" round color="primary" size="sm" icon="chevron_left" @click="prevWeek" style="margin-right: 6px;" />
            <q-btn class="glossy" round color="primary" size="sm" icon="chevron_right" @click="nextWeek" />
          </div>
        </div>
        <table class="schedule-table">
          <thead>
            <tr>
              <th class="left-col" width="150px">Date</th>
              <th class="right-col">Tasks</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIdx) in tableRows" :key="row.label" :class="{ 'highlight-row': isCurrent(row.label) }">
              <td class="left-col">{{ row.label }}</td>
              <td class="right-col">
                <div class="task-list">
                  <transition-group name="fade" tag="span" style="padding-right: 10px">
                    <span v-for="(task, tIdx) in row.tasks" :key="task" class="task-chip" :title="task">
                      <span class="task-chip-text">{{ task }}</span>
                      <button @click="removeTask(rowIdx, tIdx)" class="chip-remove">&times;</button>
                    </span>
                  </transition-group>
                  <div v-if="getAvailableTasksForDay(row.date).length > 0">
                    <span
                      v-for="task in getAvailableTasksForDay(row.date)"
                      :key="task.ID"
                      :title="`𝗜𝗗 ${task.ID}\n𝗣𝗿𝗼𝗷𝗲𝗰𝘁 : ${task.project_name}\n𝗧𝗮𝘀𝗸 : ${task.task}\n𝗦𝘂𝗯𝗧𝗮𝘀𝗸 : ${
                        task.sub_task
                      }\n𝗔𝘀𝘀𝗶𝗴𝗻𝗲𝗱 𝘁𝗼 ${task.assigned_to || '-'}`"
                      class="filtered-task-item"
                    >
                      <span class="task-id">{{ task.ID }}</span>
                      <span class="task-title">{{ task.sub_task }}</span>
                      <span
                        v-if="task.status"
                        class="status-badge"
                        :style="{ backgroundColor: getStatusColor(task.status) }"
                        :title="getStatusName(task.status)"
                      >
                        {{ getStatusName(task.status) }}
                      </span>
                    </span>
                  </div>
                  <div v-else class="no-tasks-message">No tasks available for this day</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </LoadingSpinner>
  </q-card>
</template>

<style lang="scss" scoped>
.schedule-root {
  border-radius: 15px;
  min-height: 80vh;
  padding: 2rem;
  margin: 2rem;
  position: relative;
  padding-bottom: 6rem;
}
.schedule-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin: 0 10px 14px;
}
.schedule-project-selects {
  display: flex;
  align-items: center;

  select {
    width: 320px;
  }
}

.available-status-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.available-label {
  font-size: 12px;
  font-weight: 600;
  color: #059669;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.available-status-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.available-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
}
.schedule-title {
  font-size: 2rem;
  font-weight: 700;
  color: #2d3748;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
}
.schedule-selects {
  display: flex;
  align-items: center;
}
.selectbox {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f1f5f9;
  font-size: 15px;
  margin: 0 10px;
  transition: border 0.2s;
  outline: none;
  &:focus {
    border: 1.5px solid #6366f1;
  }

  &.no-project-selected {
    border-color: #ef4444;
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);
  }
}
.schedule-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
  padding: 32px 32px 24px 32px;
  margin: 0 32px;
  min-height: 400px;
  overflow-x: auto;
}
.schedule-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 4px;
  font-size: 1rem;
}
.schedule-table th {
  background: #f1f5f9;
  color: #374151;
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 2px solid #e5e7eb;
  letter-spacing: 0.5px;
}
.schedule-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fcfcfd;
  transition: background 0.2s;
}
.left-header {
  width: 180px;
  border-right: 1px solid #e7e8fd;
}
.left-col {
  background: #f8fafc;
  font-weight: 500;
  color: #6366f1;
  border-radius: 12px 0 0 12px;
  border-right: 1px solid #e7e8fd;
}
.right-col {
  border-radius: 0 12px 12px 0;
  border-right: 1px solid #e7e8fd80;
}
.highlight-row td {
  background: linear-gradient(90deg, #e0e7ff 0%, #f1f5f9 100%) !important;
  font-weight: 600;
  color: #3730a3;
}
.schedule-table tr:hover td {
  background: #f3f4f6;
}
.task-list {
  display: flex;
  align-items: center;
}
.task-chip {
  display: inline-flex;
  align-items: center;
  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
  color: #fff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 500;
  margin-right: 4px;
  margin-bottom: 4px;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.08);
  transition: transform 0.15s, box-shadow 0.15s;
  animation: popin 0.3s;
  max-width: 220px;
  min-width: 0;
  overflow: hidden;
  cursor: pointer;
}
.task-chip-text {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-remove {
  margin-left: 8px;
  color: #f87171;
  background: none;
  border: none;
  font-size: 1.1em;
  cursor: pointer;
  transition: color 0.2s;
  flex-shrink: 0;
}

.filtered-task-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  color: #4c51bf;
  border-radius: 20px;
  padding: 4px 12px 4px 16px;
  font-size: 13px;
  font-weight: 600;
  border: 2px solid #667eea26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 4px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  cursor: default;
  max-width: 360px;

  &:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
    border-color: #667eea;
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
  }

  &:active {
    transform: translateY(0);
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    border-radius: 20px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  &:hover::before {
    opacity: 1;
  }
}

.task-id {
  color: #fff;
  background-color: #7c8daa;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}

.task-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
}

.no-tasks-message {
  color: #8e9cb0;
  font-style: italic;
  font-size: 14px;
}
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.7);
}
</style>
