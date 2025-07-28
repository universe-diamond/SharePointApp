<template>
  <div :class="['sunburst-card', { fullscreen: isFullscreen }]">
    <button class="fullscreen-btn" @click="toggleFullscreen">
      <span v-if="!isFullscreen">⛶</span>
      <span v-else>🗗</span>
    </button>
    <button class="addtask-btn" @click="toggleAddTaskCard">+</button>
    <SunburstChart :baseInfo="props.baseInfo" :selectedProject="selectedProject" component-id="chartId" :class="{ 'fullscreen-chart': isFullscreen }" />

    <div v-if="showAddTaskCard" class="info-card-overlay" @click="closeInfoCard">
      <div class="info-card" @click.stop>
        <div class="info-card-header">
          <h3>Add New Task</h3>
          <button @click="closeInfoCard" class="close-btn">×</button>
        </div>
        <div class="info-card-content">
          <div class="form-row">
            <q-select
              v-model="newTask.phase"
              :options="phaseOptions"
              label="Phase"
              dense outlined
              emit-value
              map-options
              :error="isFieldInvalid('phase', newTask) && newConfirmState"
              :error-message="(isFieldInvalid('phase', newTask) && newConfirmState) ? 'Required' : ''"
              style="width: 100%; margin-bottom: 12px;"
            />
            <q-input 
              v-model="newTask.task"
              label="Task"
              dense outlined 
              :error="isFieldInvalid('task', newTask) && newConfirmState"
              :error-message="(isFieldInvalid('task', newTask) && newConfirmState) ? 'Required' : ''"
              style="width: 100%; margin-bottom: 12px;"
            />
            <q-input 
              v-model="newTask.sub_task"
              label="Sub Task"
              dense outlined 
              :error="isFieldInvalid('sub_task', newTask) && newConfirmState"
              :error-message="(isFieldInvalid('sub_task', newTask) && newConfirmState) ? 'Required' : ''"
              style="width: 100%; margin-bottom: 12px;"
            />
            <q-input 
              v-model="newTask.description"
              label="Description"
              dense outlined 
              type="textarea"
              rows="3"
              style="width: 100%; margin-bottom: 12px;"
            />
            <q-input 
              v-model="newTask.groups"
              label="Groups"
              dense outlined 
              style="width: 100%; margin-bottom: 12px;"
            />
            <q-input 
              v-model="newTask.architecture"
              label="Architecture"
              dense outlined 
              style="width: 100%; margin-bottom: 12px;"
            />
          </div>
        </div>
        <div class="info-card-actions">
          <button class="close-info-btn" @click="saveNewTask" :disabled="miniLoading">
            <span v-if="miniLoading">Saving...</span>
            <span v-else>Save</span>
          </button>
          <button class="close-info-btn" @click="cancelNewTask">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import SunburstChart from "../Charts/Sunburst.vue";
import { useTaskStore } from "../../store";
import { addItem } from "../../actions/addItem";
import { getItem } from "../../actions/getItem";

const props = defineProps({
  baseInfo: Array,
  selectedProject: String
})

const taskStore = useTaskStore();

const isFullscreen = ref(false);
const showAddTaskCard = ref(false);
const newConfirmState = ref(false);
const miniLoading = ref(false);

const newTask = ref({
  project_name: "",
  phase: "",
  task: "",
  sub_task: "",
  description: "",
  groups: "",
  architecture: "",
});

// Set the project name from the selected project prop
const selectedNodeInfo = computed(() => {
  if (props.selectedProject) {
    newTask.value.project_name = props.selectedProject;
  }
  return { name: props.selectedProject || "Add Task" };
});

const phaseOptions = computed(() => {
  const project = taskStore.projectList.find(
    p => p.Title === newTask.value.project_name
  );
  if (!project || !project.phases) return [];
  return project.phases.split(",").map(phase => ({
    label: phase.trim(),
    value: phase.trim()
  }));
});

function isFieldInvalid(field, record) {
  return ["phase", "task", "sub_task"].includes(field) && (!record[field] || record[field].trim() === "");
}

function isRowValid(record) {
  return ["phase", "task", "sub_task"].every(f => record[f] && record[f].trim() !== "");
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  if (isFullscreen.value) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}

function toggleAddTaskCard() {
  showAddTaskCard.value = !showAddTaskCard.value;
  if (showAddTaskCard.value) {
    // Reset form when opening
    newTask.value = {
      project_name: props.selectedProject || "",
      phase: "",
      task: "",
      sub_task: "",
      description: "",
      groups: "",
      architecture: "",
    };
    newConfirmState.value = false;
  }
}

function closeInfoCard() {
  showAddTaskCard.value = false;
}

async function saveNewTask() {
  newConfirmState.value = true;
  if (!isRowValid(newTask.value)) return;

  miniLoading.value = true;
  try {
    const res = await addItem("Tasks", newTask.value);
    taskStore.addTask({
      ...newTask.value,
      ID: res.ID
    });
    showAddTaskCard.value = false;
    newConfirmState.value = false;
  } finally {
    await new Promise(resolve => setTimeout(resolve, 500));
    miniLoading.value = false;
  }
}

function cancelNewTask() {
  showAddTaskCard.value = false;
  newConfirmState.value = false;
}

// Load projects when component mounts
onMounted(() => {
  const fields = ["ID", "Title", "phases"];
  getItem("Projects", fields).then(res => {
    taskStore.setProjects(res);
  });
});

</script>

<style scoped>
.sunburst-card {
  position: relative;
  background: #fff;
  transition: all 0.3s;
}
.fullscreen-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.addtask-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.sunburst-card.fullscreen {
  position: fixed !important;
  top: 50px;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  background: #fff;
  border-radius: 0;
  padding: 24px 0 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow-y: auto;
  box-sizing: border-box;
}
.fullscreen-chart {
  width: 35vw !important;
  height: 35vh !important;
  max-width: 650px;
  max-height: calc(65vh - 48px);
}

.info-card-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.info-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.info-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0px 20px;
  border-bottom: 1px solid #e9ecef;
}

.info-card-header .title-section {
  flex: 1;
}

.info-card-content {
  padding: 20px 24px;
}

.info-card-actions {
  padding: 16px 24px 20px;
  border-top: 1px solid #e9ecef;
  text-align: right;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.close-info-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 8px;
  font-size: 14px;
  transition: background-color 0.2s;
}

.close-info-btn:hover:not(:disabled) {
  background: #0056b3;
}

.close-info-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.close-info-btn:last-child {
  background: #6c757d;
}

.close-info-btn:last-child:hover {
  background: #545b62;
}
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}
</style>
