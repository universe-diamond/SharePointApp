<template>
  <div class="chart-container">
    <EjsChart
      ref="chart"
      :title="title"
      :primaryXAxis="primaryXAxis"
      :primaryYAxis="primaryYAxis"
      width="100%"
      height="350px"
      :legendSettings="legendSettings"
    >
      <SeriesCollection>
        <Series
          :dataSource="seriesData"
          type="Column"
          xName="country"
          yName="walnuts"
          name="Walnuts"
        />
        <Series
          :dataSource="seriesData"
          type="Column"
          xName="country"
          yName="almonds"
          name="Almonds"
        />
      </SeriesCollection>
    </EjsChart>
  </div>
</template>

<script setup>
  import { provide } from 'vue';
  import {
    ChartComponent as EjsChart,
    SeriesDirective as Series,
    SeriesCollectionDirective as SeriesCollection,
    ColumnSeries,
    Category,
    Legend,
    Tooltip
  } from "@syncfusion/ej2-vue-charts";


  const seriesData = [
    { country: 'Chile', walnuts: 175000, almonds: 11300 },
    { country: 'EU', walnuts: 140000, almonds: 135000 },
    { country: 'Turkey', walnuts: 67000, almonds: 24000 }
  ];

  const primaryXAxis = {
    valueType: 'Category',
    labelRotation: -45
  };

  const primaryYAxis = {
    title: 'Metric Tons',
    minimum: 0,
    maximum: 200000,
    interval: 50000
  };

  const title = 'Production Comparison';

  provide('chart', [ColumnSeries, Category, Legend, Tooltip]);
</script>

<style scoped>
  .chart-container {
    width: 100%;
    height: 400px;
    min-width: 300px;
    max-width: 100%;
  }

  /* Series colors */
  .e-series-0 rect { fill: #4472c4; } /* Blue */
  .e-series-1 rect { fill: #ed7d31; } /* Orange */
</style>