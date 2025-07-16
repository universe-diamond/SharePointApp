<template>
  <a-card bordered style="margin-bottom: 20px;">
    <h2>Task List</h2>
    <a-table :columns="columns" :data-source="tasks" row-key="key" bordered :pagination="false">
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.dataIndex === 'select'">
          <a-checkbox v-model:checked="record.selected" />
        </template>
        <template v-else-if="column.dataIndex === 'type'">
          <span v-if="record.type === 'epic'">
            <a-icon type="thunderbolt" style="color: #9254de" />
          </span>
          <span v-else>
            <a-checkbox checked disabled />
          </span>
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <a-tag v-if="record.status === 'TO DO'" color="default">TO DO</a-tag>
          <a-tag v-else-if="record.status === 'IN PROGRESS'" color="blue">IN PROGRESS</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'comments'">
          <a-input placeholder="Add comment" size="small" />
        </template>
        <template v-else-if="column.dataIndex === 'assignee'">
          <span />
        </template>
        <template v-else-if="column.dataIndex === 'dueDate'">
          <a-date-picker v-if="record.dueDate" v-model:value="record.dueDate" size="small" />
        </template>
        <template v-else-if="column.dataIndex === 'labels'">
          <span />
        </template>
        <template v-else-if="column.dataIndex === 'created'">
          <a-icon type="calendar" style="margin-right: 4px" />
          {{ record.created }}
        </template>
        <template v-else-if="column.dataIndex === 'updated'">
          <a-icon type="calendar" style="margin-right: 4px" />
          {{ record.updated }}
        </template>
        <template v-else-if="column.dataIndex === 'reporter'">
          <a-avatar style="background-color: #5b6dfa; margin-right: 4px">LD</a-avatar>
          Light Dev
        </template>
        <template v-else>
          {{ record[column.dataIndex] }}
        </template>
      </template>
    </a-table>
    <div style="margin-top: 16px;">
      <a-button type="dashed" block icon="plus">Create</a-button>
    </div>
  </a-card>
</template>

<script setup>
import { ref } from 'vue';
import dayjs from 'dayjs';

const columns = [
  { title: '', dataIndex: 'select', width: 40 },
  { title: 'Type', dataIndex: 'type', width: 60 },
  { title: 'Key', dataIndex: 'key', width: 100 },
  { title: 'Summary', dataIndex: 'summary', width: 150 },
  { title: 'Status', dataIndex: 'status', width: 120 },
  { title: 'Comments', dataIndex: 'comments', width: 140 },
  { title: 'Assignee', dataIndex: 'assignee', width: 100 },
  { title: 'Due date', dataIndex: 'dueDate', width: 120 },
  { title: 'Labels', dataIndex: 'labels', width: 100 },
  { title: 'Created', dataIndex: 'created', width: 120 },
  { title: 'Updated', dataIndex: 'updated', width: 120 },
  { title: 'Reporter', dataIndex: 'reporter', width: 140 },
];

const tasks = ref([
  {
    selected: false,
    type: 'epic',
    key: 'MF111-1',
    summary: 'sdf',
    status: 'TO DO',
    comments: '',
    assignee: '',
    dueDate: dayjs('2025-07-31'),
    labels: '',
    created: 'Jul 14, 2025',
    updated: 'Jul 14, 2025',
    reporter: 'Light Dev',
  },
  {
    selected: false,
    type: 'task',
    key: 'MF111-2',
    summary: '123wwd',
    status: 'TO DO',
    comments: '',
    assignee: '',
    dueDate: null,
    labels: '',
    created: 'Jul 14, 2025',
    updated: 'Jul 14, 2025',
    reporter: 'Light Dev',
  },
  {
    selected: false,
    type: 'task',
    key: 'MF111-3',
    summary: 'gfjghfg',
    status: 'IN PROGRESS',
    comments: '',
    assignee: '',
    dueDate: null,
    labels: '',
    created: 'Jul 14, 2025',
    updated: 'Jul 14, 2025',
    reporter: 'Light Dev',
  },
  {
    selected: false,
    type: 'task',
    key: 'MF111-4',
    summary: '132',
    status: 'IN PROGRESS',
    comments: '',
    assignee: '',
    dueDate: null,
    labels: '',
    created: 'Jul 14, 2025',
    updated: 'Jul 15, 2025',
    reporter: 'Light Dev',
  },
]);
</script>

<style lang="scss">
.a-table {
  th, td {
    text-align: center;
    vertical-align: middle;
  }
}
</style>