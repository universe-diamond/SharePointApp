<script setup>
import { ref, provide, onMounted, watch, computed } from "vue";
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Edit,
  Toolbar,
  Selection,
  DayMarkers,
} from "@syncfusion/ej2-vue-gantt";
import * as XLSX from "xlsx";

import { useTimelineStore } from "../store";
import { addItem } from "../actions/addItem";
import { editItem } from "../actions/editItem";
import { getItem } from "../actions/getItem";
import { getAllItems } from "../actions/getAllItem";
import LoadingSpinner from "../components/LoadingSpinner.vue";

const timelineStore = useTimelineStore();

defineExpose({
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
});

defineOptions({ name: "ProjectTimeline" });

const fileInput = ref(null);
const selectedFile = ref(null);

const selectedProject = ref(null);
const ganttData = ref([]);
const loading = ref(true);


function normalizeGanttDates(item) {
  const dateFields = ["start_date", "deadline_date"];
  const newItem = { ...item };
  dateFields.forEach((field) => {
    if (newItem[field] && typeof newItem[field] === "string") {
      newItem[field] = new Date(newItem[field]);
    }
  });
  if (Array.isArray(newItem.subtasks)) {
    newItem.subtasks = newItem.subtasks.map(normalizeGanttDates);
  }
  return newItem;
}

provide("gantt", [Edit, Toolbar, Selection, DayMarkers]);

watch(
  () => selectedProject.value,
  (source) => {
    ganttData.value = timelineStore.timelineList.filter((item) => item.project_name == source);
  },
  { immediate: true, deep: true }
);

const taskFields = {
  id: "ID",
  name: "sub_task",
  assignedTo: "assigned_to",
  Dependency: "dependency",
  startDate: "start_date",
  endDate: "endDate",
  deadlineDate: "deadline_date",
  duration: "duration",
  passedDays: "passed_days",
  leftDays: "left_days",
  progress: "timeline_progress",
  status: "status",
  resourceInfo: "resourceInfo",
  indicators: "Indicators",
};
const viewMode = ref({ timelineViewMode: "Week" });

const editSettings = ref({
  allowEditing: true,
});

const labelSettings = ref({
  taskLabel: "sub_task",
  taskLabelFont: {
    size: "12px",
    color: "#ffffff",
  },
  taskLabelPosition: "Left",
});

const taskbarRendering = (args) => {
  if (args.data.sub_task) {
    const taskbar = args.element;
    const textElement = taskbar.querySelector(".e-taskbar-text");
    if (textElement) {
      textElement.style.textAlign = "left";
      textElement.style.width = "100%";
      textElement.style.position = "absolute";
      textElement.style.left = "50%";
      textElement.style.top = "50%";
      textElement.style.transform = "translate(-50%, -50%)";
    }
  }
};
const splitterSettings = ref({ position: "23%" });
const allowSelection = ref(true);

function onActionComplete(args) {
  if (args.requestType === "save") {
    const editData = {
      sub_task: args.data.sub_task,
      assigned_to: args.data.assigned_to,
      dependency: args.data.dependency,
      start_date: args.data.start_date,
      deadline_date: args.data.deadline_date,
      duration: args.data.duration,
      passed_days: args.data.passed_days,
      left_days: args.data.left_days,
      timeline_progress: args.data.timeline_progress,
      status: args.data.status,
    };

    editItem("Tasks", args.data.ID, editData).then((res) => {
      timelineStore.editLine(
        normalizeGanttDates({
          ...editData,
          ID: args.data.ID,
        })
      );
    });
  }
}

const statusOptions = computed(() => {
  const selection = timelineStore.ProjectsInfo.find((item) => item.Title == selectedProject.value);
  return selection && selection.status
    ? selection.status.split(",").map((item) => ({
        value: item.split("#")[0],
        text: item.split("#")[0],
        color: "#" + item.split("#")[1],
      }))
    : [];
});

const statusEditParams = ref({
  params: {
    dataSource: statusOptions,
    fields: { text: "text", value: "value" },
    allowFiltering: true,
    popupHeight: "200px",
  },
});

const assignerOptions = computed(() => {
  const selection = timelineStore.ProjectsInfo.find((item) => item.Title == selectedProject.value);
  return selection && selection.members
    ? selection.members.split(",").map((item) => ({
        value: item,
        text: item,
      }))
    : [];
});

const assignedEditParams = ref({
  params: {
    dataSource: assignerOptions,
    fields: { text: "text", value: "value" },
    allowFiltering: true,
    popupHeight: "200px",
  },
});

const projectOptions = computed(() =>
  timelineStore.ProjectsInfo.map((project) => project.Title)
);

function queryTaskbarInfo(args) {
  const info = timelineStore.ProjectsInfo.find((item) => (item.Title == selectedProject));

  if (!info) return args.taskbarBgColor = "#666";

  const selectionStatus = info.status.split(",");

  const temp = selectionStatus.find((item) => item.split("#")[0] == args.data.status);

  args.taskbarBgColor = "#" + temp.split("#")[1];
}

onMounted(() => {
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

  getAllItems("Tasks", fields1).then((res) => {
    const normalized = res.map(normalizeGanttDates);
    timelineStore.setList(normalized);
    loading.value = false;
  });

  const fields2 = ["ID", "Title", "phases", "members", "status"];

  getItem("Projects", fields2).then((res) => {
    timelineStore.setProjects(res);
  });
});
</script>

<template>
  <LoadingSpinner :showing="loading" text="Loading project timeline...">
    <q-card class="timeline-body">
      <div style="margin-bottom: 1rem">
        <q-select
          v-model="selectedProject"
          :options="projectOptions"
          dense
          outlined
          style="width: 40%"
          emit-value
          map-options
          :clearable="true"
        />
      </div>
      <GanttComponent
        :dataSource="ganttData"
        :taskFields="taskFields"
        :treeColumnIndex="1"
        :height="600"
        :timelineSettings="viewMode"
        :editSettings="editSettings"
        :labelSettings="labelSettings"
        :splitterSettings="splitterSettings"
        :allowSelection="allowSelection"
        :highlightWeekends="true"
        :taskbarHeight="30"
        :rowHeight="50"
        :queryTaskbarInfo="queryTaskbarInfo"
        :actionComplete="onActionComplete"
        :taskbarRendering="taskbarRendering"
      >
        <ColumnsDirective>
          <ColumnDirective field="ID" headerText="Task ID" width="70" textAlign="Right"></ColumnDirective>
          <ColumnDirective field="sub_task" headerText="Task Name" textAlign="Left" width="200"></ColumnDirective>
          <ColumnDirective
            field="assigned_to"
            headerText="Assigned To"
            textAlign="Left"
            width="100"
            editType="dropdownedit"
            :edit="assignedEditParams"
          ></ColumnDirective>
          <ColumnDirective field="dependency" headerText="Dependency" textAlign="Left" width="100"></ColumnDirective>
          <ColumnDirective
            field="start_date"
            headerText="Start Date"
            textAlign="Right"
            format="dd-MM-yy"
            width="150"
          ></ColumnDirective>
          <ColumnDirective
            field="deadline_date"
            headerText="Deadline Date"
            textAlign="Right"
            type="date"
            editType="datepickeredit"
            format="dd-MM-yy"
            width="150"
          ></ColumnDirective>
          <ColumnDirective field="duration" headerText="Duration" textAlign="Left" width="100"></ColumnDirective>
          <ColumnDirective
            field="passed_days"
            headerText="Days Passed From Start Date"
            textAlign="Left"
            width="100"
          ></ColumnDirective>
          <ColumnDirective
            field="left_days"
            headerText="Days Left To Deadline"
            textAlign="Left"
            width="100"
          ></ColumnDirective>
          <ColumnDirective
            field="timeline_progress"
            headerText="Timeline Progress"
            textAlign="Left"
            width="110"
          ></ColumnDirective>
          <ColumnDirective
            field="status"
            headerText="Status"
            textAlign="Right"
            width="150"
            editType="dropdownedit"
            :edit="statusEditParams"
          />
        </ColumnsDirective>
      </GanttComponent>
    </q-card>
  </LoadingSpinner>
</template>

<style lang="scss" scoped>
@import url("https://cdn.syncfusion.com/ej2/tailwind.css");
.timeline-body {
  margin: 2rem;
  padding: 2rem;
  background: #ffffff;
  min-height: 80vh;
  border-radius: 15px;
}
.import-section {
  .import-card {
    background: #f8f9fa;
    border: 2px dashed #dee2e6;
    border-radius: 8px;

    &:hover {
      border-color: #007bff;
      background: #f0f8ff;
    }
  }
}
</style>
