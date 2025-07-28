<script setup>
import { ref, provide, onMounted, watch } from "vue";
import { GanttComponent, ColumnsDirective, ColumnDirective, Edit, Toolbar, Selection, DayMarkers, Dependency } from "@syncfusion/ej2-vue-gantt";
import * as XLSX from 'xlsx';

import { useTimelineStore } from "../store";
import { addItem } from '../actions/addItem';
import { editItem } from '../actions/editItem';
import { getItem } from '../actions/getItem';
import { deleteItem } from '../actions/deleteItem';
import LoadingSpinner from "../components/LoadingSpinner.vue";

const timelineStore = useTimelineStore();

provide('gantt', [Edit, Toolbar, Selection, DayMarkers]);

defineExpose({
  GanttComponent,
  ColumnsDirective,
  ColumnDirective
});
defineOptions({ name: "ProjectTimeline" });

const fileInput = ref(null);
const selectedFile = ref(null);

const isImporting = ref(false);
const importProgress = ref(0);
const importTotal = ref(0);
const importCurrent = ref(0);

const ganttData = ref([]);
const loading = ref(true);

function excelSerialToDate(serial) {
  const excelEpochOffset = 25569;
  const millisecondsInDay = 86400 * 1000;
  return new Date((serial - excelEpochOffset) * millisecondsInDay);
}

function formatDate(date) {
  if (!date) return ''; // If date is invalid, return an empty string

  const yyyy = date.getFullYear();
  let mm = date.getMonth() + 1; // Months are zero-indexed
  let dd = date.getDate();

  // Add leading zeroes for single-digit months and days
  mm = mm < 10 ? '0' + mm : mm;
  dd = dd < 10 ? '0' + dd : dd;

  return `${yyyy}-${mm}-${dd}`; // Return the date string in 'yyyy-MM-dd' format
}

function timelineProgressFormat(timeline) {
  if(timeline == "" || timeline == null) return ""
  return timeline * 100;
}

const statusHash = {
  "COMPLETED": "completed",
  "NOT STARTED": "notstarted",
  "DELAYED": "delayed",
  "ON GOING": "inprogress",
  "AT RISK": "",
  "PENDING": "roadblock",
  "ON TIME":"",
  "LATE": ""
}

const handleFileUpload = async (file) => {
  if (!file) return;

  isImporting.value = true;
  importProgress.value = 0;
  importCurrent.value = 0;

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const filteredData = jsonData.filter(row => row['Activity'] && row['Start Date'] && row['Deadline Date']);

    const normalizedData = filteredData.map(item => {
      return {
        Title: String(item['Activity'] || ''),
        assigned_to: String(item['Assigned To'] || ''),
        dependency: String(item['Dependency'] || ''),
        start_date: formatDate(excelSerialToDate(item['Start Date'])) || '',
        deadline_date: formatDate(excelSerialToDate(item['Deadline Date'])) || '',
        duration: Number(item['Project Duration'] || 0),
        passed_days: String(item['Days Passed From Start Date'] || ''),
        left_days: String(item['Days Left To Deadline Date'] || ''),
        timeline_progress: Number(timelineProgressFormat(item['Timeline Progress']) || 0),
        status: String(statusHash[item['Status']] || ''),
      };
    });

    const normalGanttData = normalizedData.map(item => normalizeGanttDates(item));

    const finalData = normalGanttData.filter(t =>
      t.Title.trim()
    );

    importTotal.value = finalData.length;
    importCurrent.value = 0;

    for (let i = 0; i < finalData.length; i++) {
      const timeline = finalData[i];
      try {
        console.log(timeline)
        const res = await addItem("Plans", timeline);
        timelineStore.addLine({ ...timeline, ID: res.ID });
        
        importCurrent.value = i + 1;
        importProgress.value = Math.round((importCurrent.value / importTotal.value) * 100);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error("Failed to import timeline:", timeline, error);
      }
    }

    selectedFile.value = null;
    
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

function normalizeGanttDates(item) {
  const dateFields = ["start_date", "end_date", "deadline_date"];
  const newItem = { ...item };
  dateFields.forEach(field => {
    if (newItem[field] && typeof newItem[field] === "string") {
      newItem[field] = new Date(newItem[field]);
    }
  });
  if (Array.isArray(newItem.subtasks)) {
    newItem.subtasks = newItem.subtasks.map(normalizeGanttDates);
  }
  return newItem;
}

onMounted(() => {
  loading.value = true;
  const fields = ["ID", "Title", "assigned_to", "dependency", "start_date", "end_date", "deadline_date", "duration", "passed_days", "left_days", "timeline_progress", "status", "resource_info"];
  getItem("Plans", fields).then(res => {
    const normalized = res.map(normalizeGanttDates);
    timelineStore.setList(normalized);
    loading.value = false;
  })
})

watch(
  () => timelineStore.timelineList,
  (source) => {
    ganttData.value = source
  },
  { immediate: true, deep: true }
)

const taskFields = {
  id: "ID",
  name: "Title",
  assignedTo: "assigned_to",
  Dependency: "dependency",
  startDate: "start_date",
  endDate: "end_date",
  deadlineDate: "deadline_date",
  duration: "duration",
  passedDays: "passed_days",
  leftDays: "left_days",
  progress: "timeline_progress",
  status: "status",
  resourceInfo: "resource_info",
  indicators: "Indicators",
};
const viewMode = ref({ timelineViewMode: "Week" });
const editSettings = ref({
  allowAdding: true,
  allowEditing: true,
  allowDeleting: true,
  allowTaskbarEditing: true,
  showDeleteConfirmDialog: true,
});
const labelSettings = ref({
    taskLabel: "Title",
    taskLabelFont: {
      size: "12px",
      color: "#ffffff"
    },
    taskLabelPosition: "Left"
});

const taskbarRendering = (args) => {
  if (args.data.Title) {
    const taskbar = args.element;
    const textElement = taskbar.querySelector('.e-taskbar-text');
    if (textElement) {
      textElement.style.textAlign = 'left';
      textElement.style.width = '100%';
      textElement.style.position = 'absolute';
      textElement.style.left = '50%';
      textElement.style.top = '50%';
      textElement.style.transform = 'translate(-50%, -50%)';
    }
  }
};
const splitterSettings = ref({ position: "23%" });
const toolbar = ref(["Add", "Edit", "Delete", "Update", "Cancel"]);
const allowSelection = ref(true);

function onActionComplete(args) {
  if (args.requestType === "add") {
    const addData = {
      Title: args.data.Title,
      assigned_to: args.data.assigned_to,
      dependency: args.data.dependency,
      start_date: args.data.start_date,
      end_date: args.data.end_date,
      deadline_date: args.data.deadline_date,
      duration: args.data.duration,
      passed_days: args.data.passed_days,
      left_days: args.data.left_days,
      timeline_progress: args.data.timeline_progress,
      status: args.data.status,
      resource_info: args.data.resource_info,
    };
    addItem("Plans", addData).then(res => {
      timelineStore.addLine(normalizeGanttDates({
        ...addData,
        ID: res.ID
      }))
    })
  } else if (args.requestType === "save") {
    const editData = {
      Title: args.data.Title,
      assigned_to: args.data.assigned_to,
      dependency: args.data.dependency,
      start_date: args.data.start_date,
      end_date: args.data.end_date,
      deadline_date: args.data.deadline_date,
      duration: args.data.duration,
      passed_days: args.data.passed_days,
      left_days: args.data.left_days,
      timeline_progress: args.data.timeline_progress,
      status: args.data.status,
      resource_info: args.data.resource_info,
    };

    editItem("Plans", args.data.ID, editData).then(res => {
      timelineStore.addLine(normalizeGanttDates({
        ...editData,
        ID: args.data.ID
      }))
    });
  } else if (args.requestType === "delete") {
    deleteItem("Plans", args.data.map(item => item.ID)).then(res => {
      timelineStore.deleteLine(args.data.map(item => item.ID))
    });
  }
}

const statusOptions = [
  { value: "notstarted", text: "NOT STARTED" },
  { value: "inprogress", text: "IN PROGRESS" },
  { value: "delayed", text: "DELAYED" },
  { value: "roadblock", text: "ROADBLOCK" },
  { value: "completed", text: "COMPLETED" },
];

const statusEditParams = ref({
  params: {
    dataSource: statusOptions,
    fields: { text: "text", value: "value" },
    allowFiltering: true,
    popupHeight: "200px",
  },
});

function queryTaskbarInfo(args) {
  switch (args.data.status) {
    case "completed":
      args.taskbarBgColor = "green";
      break;
    case "roadblock":
      args.taskbarBgColor = "red";
      break;
    case "delayed":
      args.taskbarBgColor = "yellow";
      break;
    case "inprogress":
      args.taskbarBgColor = "blue";
      break;
    default:
      args.taskbarBgColor = "grey";
  }
}

</script>

<template>
  <LoadingSpinner :showing="loading" text="Loading project timeline...">
    <q-card class="timeline-body">
      <div class="import-section q-mb-md">
        <div style="margin-bottom: 1rem">
          <a href="/src/assets/data/Timeline_template.xlsx">Timeline_template.xlsx</a>
        </div>
        <q-card class="import-card">
          <q-card-section>
            <div class="text-h6 q-mb-sm">Import Timeline from Excel</div>
            
            <div class="row q-gutter-md items-center">
              <q-file
                ref="fileInput"
                v-model="selectedFile"
                label="Choose Excel File"
                accept=".xlsx,.xls"
                outlined
                dense
                @update:model-value="handleFileUpload"
                class="col-grow"
              >
                <template v-slot:prepend>
                  <q-icon name="upload_file" />
                </template>
              </q-file>
              
              <q-btn
                v-if="isImporting"
                color="primary"
                :loading="true"
                :label="`Importing... ${importProgress}%`"
                class="col-auto"
              />
            </div>
            
            <div v-if="isImporting" class="q-mt-sm">
              <q-linear-progress
                :value="importProgress / 100"
                color="primary"
                class="q-mb-xs"
              />
              <div class="text-caption">
                Imported {{ importCurrent }} of {{ importTotal }} items
              </div>
            </div>
          </q-card-section>
        </q-card>
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
        :toolbar="toolbar"
        :allowSelection="allowSelection"
        :highlightWeekends="true"
        :taskbarHeight="30"
        :rowHeight="50"
        :queryTaskbarInfo="queryTaskbarInfo"
        :actionComplete="onActionComplete"
        :taskbarRendering="taskbarRendering"
      >
        <ColumnsDirective>
          <ColumnDirective
            field="ID"
            headerText="Task ID"
            width="70"
            textAlign="Right"
          ></ColumnDirective>
          <ColumnDirective
            field="Title"
            headerText="Task Name"
            textAlign="Left"
            width="200"
          ></ColumnDirective>
          <ColumnDirective
            field="assigned_to"
            headerText="Assigned To"
            textAlign="Left"
            width="100"
          ></ColumnDirective>
          <ColumnDirective
            field="dependency"
            headerText="Dependency"
            textAlign="Left"
            width="100"
          ></ColumnDirective>
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
          <ColumnDirective
            field="duration"
            headerText="Duration"
            textAlign="Left"
            width="100"
          ></ColumnDirective>
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
