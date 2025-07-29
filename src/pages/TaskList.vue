<script setup>
import { ref, onMounted, watch, computed } from "vue";
import * as XLSX from "xlsx";

import { useTaskStore } from "../store";
import { addItem } from "../actions/addItem";
import { getItem } from "../actions/getItem";
import { editItem } from "../actions/editItem";
import { deleteItem } from "../actions/deleteItem";
import { getAllItems } from "../actions/getAllItem";
import LoadingSpinner from "../components/LoadingSpinner.vue";

const taskStore = useTaskStore();

const searchText = ref("");

const fileInput = ref(null);

const isImporting = ref(false);
const importProgress = ref(0);
const importTotal = ref(0);
const importCurrent = ref(0);

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isImporting.value = true;
  importProgress.value = 0;
  importCurrent.value = 0;

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    const importedTasks = jsonData.map((row) => ({
      project_name: String(row["ProjectName"] || ""),
      phase: String(row["Phase"] || ""),
      task: String(row["Task"] || ""),
      sub_task: String(row["SubTask"] || ""),
      description: String(row["Description"] || ""),
      groups: String(row["Groups"] || ""),
      architecture: String(row["Architecture"] || ""),
    }));

    const validTasks = importedTasks.filter(
      (t) => t.project_name.trim() && t.phase.trim() && t.task.trim() && t.sub_task.trim()
    );

    importTotal.value = validTasks.length;
    importCurrent.value = 0;

    for (let i = 0; i < validTasks.length; i++) {
      const task = validTasks[i];
      try {
        const res = await addItem("Tasks", task);
        taskStore.addTask({ ...task, ID: res.ID });

        importCurrent.value = i + 1;
        importProgress.value = Math.round((importCurrent.value / importTotal.value) * 100);

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error("Failed to add task:", task, error);
      }
    }

    event.target.value = "";
  } catch (error) {
    console.error("Error importing file:", error);
  } finally {
    setTimeout(() => {
      isImporting.value = false;
      importProgress.value = 0;
      importCurrent.value = 0;
      importTotal.value = 0;
    }, 1000);
  }
};

const newTask = ref({
  project_name: "",
  phase: "",
  task: "",
  sub_task: "",
  description: "",
  groups: "",
  architecture: "",
});

const showAddForm = ref(false);
const newConfirmState = ref(false);
const miniLoading = ref(false);

onMounted(() => {
  taskStore.setLoading(true);
  const fields1 = ["ID", "project_name", "phase", "task", "sub_task", "description", "groups", "architecture"];

  const fields2 = ["ID", "Title", "phases"];

  getAllItems("Tasks", fields1).then(async (res) => {
    getItem("Projects", fields2).then((res2) => {
      taskStore.setProjects(res2);
    });
    taskStore.setTasks(res);
    await new Promise((resolve) => setTimeout(resolve, 500));
    taskStore.setLoading(false);
  });
});

const hasSelectedRows = () => {
  // Check if any actual task nodes are selected (not project/phase/task keys)
  return selectedNodes.value.some((key) => {
    return typeof key === "number" || !isNaN(parseInt(key));
  });
};

const hasCheckedRows = () => {
  // Check if any actual task nodes are checked (not project/phase/task keys)
  return checkedNodes.value.some((key) => {
    return typeof key === "number" || !isNaN(parseInt(key));
  });
};

const handleSearch = (value) => {
  searchText.value = value;
};

function isFieldInvalid(field, record) {
  return (
    ["project_name", "phase", "task", "sub_task"].includes(field) && (!record[field] || record[field].trim() === "")
  );
}

function isRowValid(record) {
  return ["project_name", "phase", "task", "sub_task"].every((f) => record[f] && record[f].trim() !== "");
}

const addNewRow = () => {
  showAddForm.value = true;

  newTask.value = {
    project_name: "",
    phase: "",
    task: "",
    sub_task: "",
    description: "",
    groups: "",
    architecture: "",
  };
};

async function saveNewTask() {
  newConfirmState.value = true;
  if (!isRowValid(newTask.value)) return;

  miniLoading.value = true;
  try {
    const res = await addItem("Tasks", newTask.value);
    taskStore.addTask({
      ...newTask.value,
      ID: res.ID,
    });
    showAddForm.value = false;
    newConfirmState.value = false;
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 500));
    miniLoading.value = false;
  }
}

function cancelNewTask() {
  showAddForm.value = false;
  newConfirmState.value = false;
}

const deleteSelectedRows = () => {
  // Get selected task IDs from tree selection
  const selectedTaskIds = selectedNodes.value.filter((key) => {
    // Only include actual task IDs (not project/phase/task keys)
    return typeof key === "number" || !isNaN(parseInt(key));
  });

  if (selectedTaskIds.length === 0) return;

  deleteItem("Tasks", selectedTaskIds).then((res) => {
    taskStore.deleteTasks(selectedTaskIds);
    selectedNodes.value = []; // Clear selection after deletion
  });
};

const deleteCheckedRows = () => {
  // Get checked task IDs from tree selection
  const checkedTaskIds = checkedNodes.value.filter((key) => {
    // Only include actual task IDs (not project/phase/task keys)
    return typeof key === "number" || !isNaN(parseInt(key));
  });

  if (checkedTaskIds.length === 0) return;

  deleteItem("Tasks", checkedTaskIds).then((res) => {
    taskStore.deleteTasks(checkedTaskIds);
    checkedNodes.value = []; // Clear selection after deletion
  });
};

const selectAllTasks = () => {
  // Get all task IDs from the tree
  const getAllTaskIds = (nodes) => {
    let taskIds = [];
    for (const node of nodes) {
      if (node.taskData) {
        taskIds.push(node.key);
      }
      if (node.children) {
        taskIds = taskIds.concat(getAllTaskIds(node.children));
      }
    }
    return taskIds;
  };

  checkedNodes.value = getAllTaskIds(treeData.value);
};

const clearAllSelections = () => {
  checkedNodes.value = [];
};

const projectOptions = computed(() =>
  taskStore.projectList.map((project) => ({
    label: project.Title,
    value: project.Title,
  }))
);

const phaseOptions = computed(() => {
  const project = taskStore.projectList.find((p) => p.Title === newTask.value.project_name);
  if (!project || !project.phases) return [];
  return project.phases.split(",").map((phase) => ({
    label: phase.trim(),
    value: phase.trim(),
  }));
});

const taskOptions = computed(() => {
  const uniqueTasks = [
    ...new Set(
      taskStore.taskList
        .filter((task) => task.project_name == newTask.value.project_name && task.phase == newTask.value.phase)
        .map((task) => task.task)
        .filter((task) => task && task.trim())
    ),
  ];
  return uniqueTasks.map((task) => ({
    label: task,
    value: task,
  }));
});

// Tree structure for tasks
const treeData = computed(() => {
  const projects = {};

  taskStore.taskList.forEach((task) => {
    if (!task.project_name || !task.phase || !task.task || !task.sub_task) return;

    if (!projects[task.project_name]) {
      projects[task.project_name] = {
        key: `project-${task.project_name}`,
        label: task.project_name,
        icon: "folder",
        children: {},
      };
    }

    if (!projects[task.project_name].children[task.phase]) {
      projects[task.project_name].children[task.phase] = {
        key: `phase-${task.project_name}-${task.phase}`,
        label: task.phase,
        icon: "folder_open",
        children: {},
      };
    }

    if (!projects[task.project_name].children[task.phase].children[task.task]) {
      projects[task.project_name].children[task.phase].children[task.task] = {
        key: `task-${task.project_name}-${task.phase}-${task.task}`,
        label: task.task,
        icon: "assignment",
        children: {},
      };
    }

    if (!projects[task.project_name].children[task.phase].children[task.task].children[task.sub_task]) {
      projects[task.project_name].children[task.phase].children[task.task].children[task.sub_task] = {
        key: task.ID,
        label: task.sub_task,
        icon: "list",
        taskData: task,
        children: [],
        checkable: true, // Make leaf nodes checkable
      };
    }
  });

  // Convert to array format for q-tree
  return Object.values(projects).map((project) => ({
    ...project,
    children: Object.values(project.children).map((phase) => ({
      ...phase,
      children: Object.values(phase.children).map((task) => ({
        ...task,
        children: Object.values(task.children),
      })),
    })),
  }));
});

const expandedNodes = ref([]);
const selectedNodes = ref([]);
const checkedNodes = ref([]); // Add this for checkbox functionality
const breadcrumbs = ref([]);
const currentPath = ref([]);

function handleProjectChange(val) {
  newTask.value.project_name = val;
  newTask.value.phase = ""; // Reset phase when project changes
}

function handleEditProjectChange(val, row) {
  row.project_name = val;
  row.phase = "";
}

const filteredTreeData = computed(() => {
  if (!searchText.value) return treeData.value;

  // Filter tree data based on search text and auto-expand matching nodes
  const filterNode = (node) => {
    if (node.taskData) {
      // For leaf nodes (sub_tasks), check all fields
      const task = node.taskData;
      const searchLower = searchText.value.toLowerCase();
      const matches =
        (task.project_name && task.project_name.toLowerCase().includes(searchLower)) ||
        (task.phase && task.phase.toLowerCase().includes(searchLower)) ||
        (task.task && task.task.toLowerCase().includes(searchLower)) ||
        (task.sub_task && task.sub_task.toLowerCase().includes(searchLower)) ||
        (task.description && task.description.toLowerCase().includes(searchLower)) ||
        (task.groups && task.groups.toLowerCase().includes(searchLower)) ||
        (task.architecture && task.architecture.toLowerCase().includes(searchLower));

      if (matches) {
        // Auto-expand all parent nodes when a match is found
        const expandParents = (nodes, targetKey) => {
          for (const n of nodes) {
            if (n.children) {
              for (const child of n.children) {
                if (child.key === targetKey || expandParents([child], targetKey)) {
                  if (!expandedNodes.value.includes(n.key)) {
                    expandedNodes.value.push(n.key);
                  }
                  return true;
                }
              }
            }
          }
          return false;
        };
        expandParents(treeData.value, node.key);
      }

      return matches;
    } else {
      // For parent nodes, check if any child matches
      const hasMatchingChild = node.children && node.children.some((child) => filterNode(child));
      if (hasMatchingChild && !expandedNodes.value.includes(node.key)) {
        expandedNodes.value.push(node.key);
      }
      return hasMatchingChild;
    }
  };

  return treeData.value.filter((project) => filterNode(project));
});

// Breadcrumb functions
const updateBreadcrumbs = (node) => {
  if (!node) return;

  // Build the complete path to the clicked node
  const buildPathToNode = (nodes, targetKey, currentPath = []) => {
    for (const n of nodes) {
      const newPath = [...currentPath, { label: n.label, key: n.key }];

      if (n.key === targetKey) {
        return newPath;
      }

      if (n.children) {
        const found = buildPathToNode(n.children, targetKey, newPath);
        if (found) return found;
      }
    }
    return null;
  };

  // Find the complete path to the clicked node
  const path = buildPathToNode(treeData.value, node.key);
  if (path) {
    breadcrumbs.value = path;
    currentPath.value = path;
  }
};

const navigateToBreadcrumb = (index) => {
  if (index < breadcrumbs.value.length) {
    const targetNode = breadcrumbs.value[index];
    // Expand to show the target node
    if (!expandedNodes.value.includes(targetNode.key)) {
      expandedNodes.value.push(targetNode.key);
    }
    // Update breadcrumbs to the selected level
    breadcrumbs.value = breadcrumbs.value.slice(0, index + 1);
    currentPath.value = breadcrumbs.value;
  }
};

// Navigate to a specific node in the tree
const navigateToNode = (targetNode) => {
  if (!targetNode) return;

  // Build the path to the target node
  const buildPath = (nodes, targetKey, currentPath = []) => {
    for (const node of nodes) {
      const newPath = [...currentPath, { label: node.label, key: node.key }];

      if (node.key === targetKey) {
        return newPath;
      }

      if (node.children) {
        const found = buildPath(node.children, targetKey, newPath);
        if (found) return found;
      }
    }
    return null;
  };

  // Find the path to the target node
  const path = buildPath(treeData.value, targetNode.key);
  if (path) {
    // Expand all parent nodes
    path.forEach((pathNode) => {
      if (!expandedNodes.value.includes(pathNode.key)) {
        expandedNodes.value.push(pathNode.key);
      }
    });

    // Update breadcrumbs
    breadcrumbs.value = path;
    currentPath.value = path;

    // Select the target node if it's a task
    if (targetNode.taskData) {
      selectedNodes.value = [targetNode.key];
    }

    // Scroll to the node after a short delay to ensure tree is rendered
    setTimeout(() => {
      const treeElement = document.querySelector(".tree-container");
      if (treeElement) {
        const targetElement = treeElement.querySelector(`[data-key="${targetNode.key}"]`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
          // Add highlight effect
          targetElement.classList.add("node-highlight");
          setTimeout(() => {
            targetElement.classList.remove("node-highlight");
          }, 2000);
        }
      }
    }, 100);
  }
};

// Get selected items details
const selectedItems = computed(() => {
  return selectedNodes.value
    .filter((key) => typeof key === "number" || !isNaN(parseInt(key)))
    .map((key) => {
      // Find the task data for the selected key
      const findTaskInTree = (nodes) => {
        for (const node of nodes) {
          if (node.key === key && node.taskData) {
            return node.taskData;
          }
          if (node.children) {
            const found = findTaskInTree(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      return findTaskInTree(treeData.value);
    })
    .filter((task) => task !== null);
});

// Get checked items details
const checkedItems = computed(() => {
  return checkedNodes.value
    .filter((key) => typeof key === "number" || !isNaN(parseInt(key)))
    .map((key) => {
      // Find the task data for the checked key
      const findTaskInTree = (nodes) => {
        for (const node of nodes) {
          if (node.key === key && node.taskData) {
            return node.taskData;
          }
          if (node.children) {
            const found = findTaskInTree(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      return findTaskInTree(treeData.value);
    })
    .filter((task) => task !== null);
});

// Highlight search text in labels
const highlightSearchText = (text) => {
  if (!searchText.value || !text) return text;

  const regex = new RegExp(`(${searchText.value})`, "gi");
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
};

// Check if node matches search
const isNodeMatchingSearch = (node) => {
  if (!searchText.value) return false;

  if (node.taskData) {
    const task = node.taskData;
    const searchLower = searchText.value.toLowerCase();
    return (
      (task.project_name && task.project_name.toLowerCase().includes(searchLower)) ||
      (task.phase && task.phase.toLowerCase().includes(searchLower)) ||
      (task.task && task.task.toLowerCase().includes(searchLower)) ||
      (task.sub_task && task.sub_task.toLowerCase().includes(searchLower)) ||
      (task.description && task.description.toLowerCase().includes(searchLower)) ||
      (task.groups && task.groups.toLowerCase().includes(searchLower)) ||
      (task.architecture && task.architecture.toLowerCase().includes(searchLower))
    );
  }

  return node.label && node.label.toLowerCase().includes(searchText.value.toLowerCase());
};
</script>

<template>
  <q-card class="tasklist-body">
    <LoadingSpinner :showing="taskStore.loading" text="Loading tasks...">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 1rem 0">
          <div style="flex: 1; max-width: 300px">
            <q-input
              white
              dense
              outlined
              rounded
              placeholder="Search tasks..."
              @search="handleSearch"
              style="width: 100%"
              v-model="searchText"
              class="q-ml-md"
              :disable="isImporting"
            >
              <template v-slot:append>
                <q-icon v-if="searchText === ''" name="search" />
                <q-icon v-else name="clear" class="cursor-pointer" @click="searchText = ''" />
              </template>
            </q-input>
          </div>
          <div>
            <q-btn color="primary" icon="add" @click="addNewRow" style="margin-right: 8px" :disable="isImporting">
              <div>Add</div>
            </q-btn>
            <q-btn
              color="red"
              icon="delete"
              @click="deleteCheckedRows"
              :disabled="!hasCheckedRows || isImporting"
              style="margin-right: 8px"
            >
              <div>Delete</div>
              <q-badge v-if="checkedItems.length > 0" color="red" floating rounded class="q-ml-xs">
                {{ checkedItems.length }}
              </q-badge>
            </q-btn>

            <q-btn
              color="secondary"
              icon="select_all"
              @click="selectAllTasks"
              :disabled="isImporting"
              style="margin-right: 8px"
            >
              <div>Select All</div>
            </q-btn>

            <q-btn
              color="grey"
              icon="clear_all"
              @click="clearAllSelections"
              :disabled="checkedItems.length === 0 || isImporting"
              style="margin-right: 8px"
            >
              <div>Clear All</div>
            </q-btn>

            <q-btn
              color="secondary"
              icon="file_upload"
              label="Import Excel"
              @click="$refs.fileInput.click()"
              :disable="isImporting"
            />
            <input type="file" ref="fileInput" style="display: none" accept=".xls,.xlsx" @change="handleFileUpload" />
          </div>
        </div>

        <div style="text-align: right; margin-bottom: 1rem">
          <a href="/src/assets/data/Tasklist_template.xlsx">Tasklist_template.xlsx</a>
        </div>

        <!-- Breadcrumbs -->
        <div v-if="breadcrumbs.length > 0" class="q-mb-md">
          <q-breadcrumbs class="text-grey-8">
            <q-breadcrumbs-el
              icon="home"
              label="Root"
              @click="
                breadcrumbs = [];
                currentPath = [];
              "
              class="cursor-pointer"
            />
            <q-breadcrumbs-el
              v-for="(crumb, index) in breadcrumbs"
              :key="crumb.key"
              :label="crumb.label"
              @click="navigateToBreadcrumb(index)"
              class="cursor-pointer"
            />
          </q-breadcrumbs>
        </div>

        <div
          v-if="isImporting"
          class="q-pa-md"
          style="background: #f0f8ff; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e3f2fd"
        >
          <div class="text-h6 q-mb-sm" style="color: #1976d2">
            <q-icon name="file_download" class="q-mr-sm" />
            Importing Excel Data...
          </div>
          <div class="q-mb-sm">
            <div class="text-caption q-mb-xs">
              Progress: {{ importCurrent }} / {{ importTotal }} tasks ({{ importProgress }}%)
            </div>
            <q-linear-progress :value="importProgress / 100" color="primary" size="md" style="height: 8px" />
          </div>
          <div class="text-caption" style="color: #666">Please wait while tasks are being imported...</div>
        </div>

        <div
          v-if="showAddForm"
          class="q-pa-md"
          style="background: #f9f9f9; border-radius: 8px; margin-bottom: 1rem"
          :class="{ 'disabled-form': isImporting }"
        >
          <div style="display: flex; gap: 1rem; flex-wrap: wrap">
            <q-select
              v-model="newTask.project_name"
              :options="projectOptions"
              label="Project Name"
              dense
              outlined
              emit-value
              map-options
              :error="isFieldInvalid('project_name', newTask) && newConfirmState"
              :error-message="isFieldInvalid('project_name', newTask) && newConfirmState ? 'Required' : ''"
              style="min-width: 150px; max-width: 190px"
              @update:model-value="handleProjectChange"
            />
            <q-select
              v-model="newTask.phase"
              :options="phaseOptions"
              label="Phase"
              dense
              outlined
              emit-value
              map-options
              :disable="!newTask.project_name"
              :error="isFieldInvalid('phase', newTask) && newConfirmState"
              :error-message="isFieldInvalid('phase', newTask) && newConfirmState ? 'Required' : ''"
              style="min-width: 150px; max-width: 190px"
            />
            <q-select
              v-model="newTask.task"
              :options="taskOptions"
              label="Task"
              dense
              outlined
              emit-value
              map-options
              use-input
              new-value-mode="add-unique"
              :error="isFieldInvalid('task', newTask) && newConfirmState"
              :error-message="isFieldInvalid('task', newTask) && newConfirmState ? 'Required' : ''"
              style="min-width: 120px; max-width: 190px"
            />
            <q-input
              v-for="field in ['sub_task', 'description', 'groups', 'architecture']"
              :key="field"
              v-model="newTask[field]"
              :label="field.charAt(0).toUpperCase() + field.slice(1).replace('_', '')"
              dense
              outlined
              :error="isFieldInvalid(field, newTask) && newConfirmState"
              :error-message="isFieldInvalid(field, newTask) && newConfirmState ? 'Required' : ''"
              style="min-width: 120px; max-width: 190px"
            />
          </div>
          <div class="q-mt-md" style="text-align: right; margin-right: 30px">
            <q-btn color="primary" @click="saveNewTask" :loading="miniLoading">
              <template v-slot:loading>
                <q-spinner size="18px" color="white" />
              </template>
              Save
            </q-btn>
            <q-btn flat @click="cancelNewTask" class="q-ml-sm">Cancel</q-btn>
          </div>
        </div>

        <!-- Tree View -->
        <div
          class="tree-container"
          style="border: 1px solid #ececec; border-radius: 8px; background: white; min-height: 600px"
        >
          <q-tree
            :nodes="filteredTreeData"
            node-key="key"
            :expanded="expandedNodes"
            :selected="selectedNodes"
            :checked="checkedNodes"
            @update:expanded="expandedNodes = $event"
            @update:selected="selectedNodes = $event"
            @update:checked="checkedNodes = $event"
            :disable="isImporting"
            style="max-height: 600px; overflow-y: auto"
          >
            <template v-slot:default-header="prop">
              <div
                class="row items-center full-width cursor-pointer"
                @click="updateBreadcrumbs(prop.node)"
                :class="{
                  'search-match': isNodeMatchingSearch(prop.node),
                  'checked-item': checkedNodes.includes(prop.node.key) && prop.node.taskData,
                }"
                :data-key="prop.node.key"
              >
                <!-- Show checkbox only for leaf nodes (tasks) -->
                <q-checkbox
                  v-if="prop.node.taskData"
                  v-model="checkedNodes"
                  :val="prop.node.key"
                  @click.stop
                  class="q-mr-sm"
                  color="primary"
                />
                <q-icon :name="prop.node.icon" class="q-mr-sm" />
                <span class="text-weight-medium" v-html="highlightSearchText(prop.node.label)"></span>
                <q-space />
                <template v-if="prop.node.taskData">
                  <q-chip
                    v-if="prop.node.taskData.description"
                    size="sm"
                    color="blue-grey-1"
                    text-color="blue-grey-8"
                    class="q-mr-xs"
                  >
                    <q-tooltip>
                      <strong>Description:</strong><br />
                      {{ prop.node.taskData.description }}
                    </q-tooltip>
                    <span v-html="highlightSearchText(prop.node.taskData.description)"></span>
                  </q-chip>
                  <q-chip
                    v-if="prop.node.taskData.groups"
                    size="sm"
                    color="green-1"
                    text-color="green-8"
                    class="q-mr-xs"
                  >
                    <q-tooltip>
                      <strong>Groups:</strong><br />
                      {{ prop.node.taskData.groups }}
                    </q-tooltip>
                    <span v-html="highlightSearchText(prop.node.taskData.groups)"></span>
                  </q-chip>
                  <q-chip v-if="prop.node.taskData.architecture" size="sm" color="orange-1" text-color="orange-8">
                    <q-tooltip>
                      <strong>Architecture:</strong><br />
                      {{ prop.node.taskData.architecture }}
                    </q-tooltip>
                    <span v-html="highlightSearchText(prop.node.taskData.architecture)"></span>
                  </q-chip>
                </template>
              </div>
            </template>
          </q-tree>
        </div>
      </div>
    </LoadingSpinner>
  </q-card>
</template>

<style lang="scss" scoped>
.tasklist-body {
  margin: 2rem;
  padding: 2rem;
  background: #ffffff;
  min-height: 80vh;
  border-radius: 15px;
}

.disabled-form {
  opacity: 0.6;
  pointer-events: none;
}

.search-highlight {
  background-color: #ffeb3b;
  color: #000;
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: bold;
}

.search-match {
  background-color: #e3f2fd;
  border-radius: 4px;
  padding: 2px;
}

.tree-container .q-tree__node--selected {
  background-color: #e8f5e8;
}

.tree-container .q-tree__node--selected .search-match {
  background-color: #c8e6c9;
}

.checked-item {
  background-color: #e8f5e8 !important;
  border-left: 3px solid #4caf50 !important;
  padding-left: 8px;
}

.checked-item.search-match {
  background-color: #c8e6c9 !important;
}

.node-highlight {
  background-color: #e3f2fd !important;
  border: 2px solid #1976d2 !important;
  border-radius: 4px;
  animation: pulse 2s ease-in-out;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}
</style>
