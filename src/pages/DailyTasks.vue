<script setup>
import { ref, onMounted, computed, watch } from "vue";
import draggable from "vuedraggable";

import { useDailytaskStore } from "../store";
import { getItem } from "../actions/getItem";
import { editItem } from "../actions/editItem";
import LoadingSpinner from "../components/LoadingSpinner.vue";

const dailytaskStore = useDailytaskStore();
const projectOptions = ref([]);

const selectedDate = ref(new Date().toISOString().substr(0, 10));
const selectedProject = ref("");

const dragInfo = ref(null);
const loading = ref(true);
const miniLoading = ref({});
const showDailyTasks = ref(false);

onMounted(async () => {
  loading.value = true;
  const fields1 = [
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
  const fields2 = ["ID", "Title", "phases", "members", "status", "key_IDs", "months", "years", "note_types"];

  await Promise.all([
    getItem("Tasks", fields1).then((res) => {
      dailytaskStore.setAllTasks(res);
    }),
    getItem("Projects", fields2).then((res) => {
      projectOptions.value = res;
    }),
  ]);

  if (selectedDate.value) {
    watchCallback(selectedDate.value);
  }
  loading.value = false;
});

watch(
  () => selectedDate.value,
  (source) => {
    watchCallback(source);
  },
  { immediate: true, deep: true }
);

function watchCallback(source) {}

function isTaskOnSelectedDate(task) {
  if (!task.start_date || !task.duration) return false;
  const start = new Date(task.start_date);
  const duration = parseInt(task.duration) || 0;
  const end = new Date(start);
  end.setDate(start.getDate() + duration);
  const selected = new Date(selectedDate.value);
  return selected >= start && selected <= end;
}

const columns = computed(() => {
  if (!selectedProject.value) return [];

  // Get the statuses for the selected project
  const projectStatuses = getProjectStatuses();

  // Get all tasks for the selected project
  const projectTasks = dailytaskStore.allTasks.filter((task) => task.project_name === selectedProject.value);

  // Create columns based on project statuses
  return projectStatuses.map((status, index) => {
    // Filter tasks for this specific status
    let statusTasks = projectTasks.filter((task) => {
      if (!task.status) return false;
      const match = task.status.match(/^([^#]+)/);
      const taskStatusName = match ? match[1].trim() : task.status;
      return taskStatusName === status.name;
    });
    if (showDailyTasks.value) {
      statusTasks = statusTasks.filter(isTaskOnSelectedDate);
    }

    return {
      id: `status-${index}`,
      title: status.name,
      editing: false,
      tasks: statusTasks.map((task) => ({
        id: task.ID,
        title: task.sub_task,
        code: task.ID,
      })),
      showingAddTask: false,
      selectedTaskId: "",
      menu: false,
    };
  });
});

function onDragStart(originColIdx) {
  return (event) => {
    dragInfo.value = {
      originColIdx,
      originBoard: columns.value[originColIdx],
      originTaskIdx: event.oldIndex,
      task: columns.value[originColIdx].tasks[event.oldIndex],
    };
  };
}
function onTaskAdd(destColIdx) {
  return (event) => {
    const origin = dragInfo.value;

    dailytaskStore.updateTask(origin.task.id, {
      status: columns.value[destColIdx].title,
    });

    editItem("Tasks", origin.task.id, {
      status: columns.value[destColIdx].title,
    });
  };
}
function onDragEnd(destColIdx) {
  return (event) => {
    dragInfo.value = null;
  };
}

// Get all unique statuses for the selected project
function getProjectStatuses() {
  if (!selectedProject.value) return [];
  // Find the selected project in projectOptions
  const project = projectOptions.value.find((p) => p.Title === selectedProject.value);
  if (!project || !project.status) return [];
  // Statuses are stored as comma-separated strings like 'In Progress#FFAA00,Completed#00FF00'
  return project.status
    .split(",")
    .map((s) => s.trim())
    .map((s) => {
      const [name, color] = s.split("#");
      return { name: name.trim(), color: color ? "#" + color.trim() : "#666" };
    });
}

// Get status summary for the selected project
function getProjectStatusSummary() {
  if (!selectedProject.value) return {};
  // Find all tasks for the selected project
  const projectTasks = dailytaskStore.allTasks.filter((task) => task.project_name === selectedProject.value);
  const statusCount = {};
  projectTasks.forEach((task) => {
    if (task.status) {
      // Extract status name (before # if present)
      const match = task.status.match(/^([^#]+)/);
      const statusName = match ? match[1].trim() : task.status;
      statusCount[statusName] = (statusCount[statusName] || 0) + 1;
    }
  });
  return statusCount;
}

// Helper to get color for a status name
function getStatusColor(statusName) {
  const statuses = getProjectStatuses();
  const found = statuses.find((s) => s.name === statusName);
  return found ? found.color : "#666";
}
</script>

<template>
  <LoadingSpinner :showing="loading" text="Loading daily tasks...">
    <q-card class="daily-tasks-body">
      <div class="kanban-header-bar">
        <div class="daily-project-selects">
          <select v-model="selectedProject" class="selectbox" :class="{ 'no-project-selected': !selectedProject }">
            <option value="" disabled>Select project</option>
            <option v-for="proj in projectOptions" :key="proj.ID" :value="proj.Title">
              {{ proj.Title }}
            </option>
          </select>
        </div>
        <div class="kanban-header-actions" style="display: flex; align-items: center; gap: 1rem">
          <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500; margin: 0">
            <input type="checkbox" v-model="showDailyTasks" /> Daily tasks
          </label>
          <input type="date" v-model="selectedDate" class="kanban-datepicker" :disabled="!showDailyTasks" />
        </div>
      </div>
      <div class="kanban-board">
        <div class="kanban-column" v-for="(column, colIdx) in columns" :key="column.id">
          <div class="kanban-header">
            <div class="kanban-header-left">
              <span v-if="!column.editing" class="kanban-title">
                <span
                  v-if="selectedProject"
                  class="status-chip"
                  :style="{
                    backgroundColor: getStatusColor(column.title),
                    color: '#fff',
                    padding: '2px 10px',
                    borderRadius: '10px',
                    fontWeight: 500,
                    fontSize: '13px',
                    marginRight: '8px',
                    display: 'inline-block',
                  }"
                >
                  {{ column.title }}
                </span>
                <span v-else>
                  {{ column.title }}
                </span>
              </span>
              <span v-if="Array.isArray(column.tasks) && column.tasks.length" class="kanban-count">{{
                column.tasks.length
              }}</span>
              <q-spinner-pie v-if="miniLoading[column.id]" size="18px" color="primary" class="mini-spinner" />
            </div>
            <div class="kanban-header-right"></div>
          </div>

          <div>
            <draggable
              v-model="column.tasks"
              group="tasks"
              :animation="200"
              item-key="id"
              class="kanban-tasks"
              @start="(event) => onDragStart(colIdx)(event)"
              @add="(event) => onTaskAdd(colIdx)(event)"
              @end="(event) => onDragEnd(colIdx)(event)"
            >
              <template :item="{ element: task, index }">
                <div class="kanban-card">
                  <div class="kanban-card-title-row">
                    <span class="kanban-card-title" :title="task.title">{{ task.title }}</span>
                  </div>
                  <div class="kanban-card-meta">
                    <span class="kanban-card-id">{{ task.code }}</span>
                  </div>
                </div>
              </template>
              <template #footer>
                <div v-if="!column.tasks.length" class="kanban-empty-placeholder">Drop tasks here</div>
              </template>
            </draggable>
          </div>
        </div>
      </div>
    </q-card>
  </LoadingSpinner>
</template>

<style lang="scss" scoped>
.daily-tasks-body {
  margin: 2rem;
  padding: 1rem;
  background: #ffffff;
  min-height: 80vh;
  border-radius: 15px;
}
.kanban-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem 0 2rem;
}
.kanban-add-board-bar {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0 0 2rem 2rem;
}
.kanban-board {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  display: flex;
  gap: 2rem;
  padding: 2rem 1rem 1rem 1rem;
  background: #fff;
  min-height: 80vh;
  white-space: nowrap;
}
.kanban-column {
  background: #fff;
  border-radius: 1.2rem;
  box-shadow: 0 4px 24px 0 rgba(25, 118, 210, 0.08); /* blue shadow */
  padding: 1.5rem 1rem 2rem 1rem;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  min-height: 500px;
  max-height: 700px;
  position: relative;
  flex-shrink: 0;
}
/* Optional: Hide scrollbar for webkit browsers */
.kanban-board::-webkit-scrollbar {
  height: 10px;
}
.kanban-board::-webkit-scrollbar-thumb {
  background: #e3f2fd;
  border-radius: 5px;
}
.kanban-board::-webkit-scrollbar-track {
  background: #fff;
}
.kanban-create-btn-large {
  padding: 0.7rem 1.5rem;
  font-size: 1.1rem;
  border-radius: 0.7rem;
  cursor: pointer;
  background: #e3f2fd;
  color: #1976d2;
  border: none;
  font-weight: 700;
  box-shadow: none;
  transition: background 0.2s;
  &:hover {
    background: #bbdefb;
  }
  .plus {
    font-size: 1.3rem;
    font-weight: 700;
    margin-right: 0.5rem;
  }
}
.kanban-datepicker {
  font-size: 1rem;
  padding: 0.3rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid #bbdefb; /* light blue */
}

.kanban-add-task-btn-small {
  padding: 0.3rem 0.7rem;
  font-size: 1.1rem;
  min-width: 0;
  width: 32px;
  cursor: pointer;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e3f2fd; /* lighter blue */
  color: #1976d2;
  border: none;
  box-shadow: none;
  transition: all 0.2s;
  &:hover {
    background: #bbdefb;
  }
  &.active {
    background: #1976d2;
    color: #fff;
  }
  .plus {
    font-size: 1.2rem;
    font-weight: 700;
  }
}
.kanban-add-board-btn {
  margin-left: 0.5rem;
}
.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 1.2rem;
  color: #1976d2;
}
.kanban-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.kanban-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.kanban-title {
  letter-spacing: 1px;
  cursor: pointer;
}
.kanban-count {
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 1rem;
  padding: 0.1rem 0.7rem;
  font-size: 0.9rem;
  margin-left: 0.3rem;
}
.kanban-done-check {
  color: #1976d2;
  font-size: 1.2rem;
  margin-left: 0.5rem;
}
.kanban-tasks {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 600px;
  overflow-y: auto;
}
.kanban-card {
  background: #f5faff;
  border-radius: 0.8rem;
  box-shadow: 0 2px 8px 0 rgba(25, 118, 210, 0.04);
  padding: 1rem 1rem 0.7rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  transition: box-shadow 0.2s;
  position: relative;
  border: 1.5px solid #e3f2fd;
  &:hover {
    box-shadow: 0 6px 24px 0 rgba(25, 118, 210, 0.13);
    border-color: #1976d2;
  }
}
.kanban-card-title-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  justify-content: space-between;
}
.kanban-card-title {
  font-size: 1.08rem;
  font-weight: 600;
  color: #1976d2;
  cursor: pointer;
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.kanban-card-meta {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-size: 0.97rem;
  color: #1976d2;
}
.kanban-card-id {
  background: #e3f2fd;
  border-radius: 0.7rem;
  padding: 0.1rem 0.6rem;
  font-size: 0.93rem;
}
.kanban-add-task-inline {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: #f8fbff;
  border-radius: 0.8rem;
  padding: 1rem;
  border: 1px solid #e3f2fd;
}
.kanban-add-task-select-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin-bottom: 0.8rem;
}
.kanban-add-task-select {
  font-size: 1rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid #e3f2fd;
  width: 180px;
  background: #fff;
  color: #1976d2;
}
.kanban-add-task-buttons {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}
.kanban-add-task-confirm-btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.3rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  flex: 1;
  &:hover {
    background: #1565c0;
  }
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
}
.kanban-add-task-cancel-btn {
  background: #f5faff;
  color: #1976d2;
  border: none;
  border-radius: 0.5rem;
  padding: 0.3rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  flex: 1;
  &:hover {
    background: #e3f2fd;
  }
}
.kanban-title-input {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1976d2;
  border: 1px solid #fde3f3;
  border-radius: 0.4rem;
  padding: 0.1rem 0.5rem;
  max-width: 180px;
}
.kanban-empty-placeholder {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b0b0b0;
  font-style: italic;
  border: 2px dashed #e3f2fd;
  border-radius: 0.7rem;
  background: #f8fbff;
  margin: 0.5rem 0;
}
.mini-spinner {
  margin-left: 0.5rem;
  vertical-align: middle;
}
.daily-project-selects {
  display: flex;
  align-items: center;

  select {
    width: 320px;
  }
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
</style>
