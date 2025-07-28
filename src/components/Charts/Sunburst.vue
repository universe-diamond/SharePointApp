<script setup>
  import {ref, onMounted, watch, computed} from 'vue';
  import * as d3 from 'd3';

  import { getItem } from '../../actions/getItem';
  import { useSunburstStore } from '../../store';

  const sunburstStore = useSunburstStore();

  const props = defineProps({
    baseInfo: Array,
    selectedProject: String
  })

  const height = ref("100%");
  const selectedItem = ref(null);
  const legendItems = ref([]);
  const chartContainer = ref(null);
  const currentRoot = ref(null);
  const chartHistory = ref([]);
  // Add hold functionality state
  const heldSegments = ref(new Set());
  const isHoldMode = ref(false);
  
  // Info card state
  const showInfoCard = ref(false);
  const selectedNodeInfo = ref(null);

  onMounted(() => {
    // Fetch data from Tasks list
    const taskFields = [
      "ID", 
      "project_name", 
      "phase", 
      "task", 
      "sub_task", 
      "description",
      "groups",
      "architecture"
    ];
    
    // Fetch data from Plans list
    const planFields = [
      "ID",
      "project_name",
      "phase", 
      "task",
      "sub_task",
      "timeline_progress",
      "status",
      "assigned_to",
      "start_date",
      "end_date",
      "duration"
    ];
    
    // Fetch both lists
    Promise.all([
      getItem("Tasks", taskFields),
      getItem("Plans", planFields)
    ]).then(([taskData, planData]) => {
      
      const mergedData = mergeTaskAndPlanData(taskData, planData);
      sunburstStore.setTaskData(mergedData);
    }).catch(error => {
      // Fallback to just Tasks data if Plans fetch fails
      getItem("Tasks", taskFields).then(taskData => {
        sunburstStore.setTaskData(taskData);
      });
    });
  })

  // Function to process long titles
  const processTitle = (title, maxLength = 15) => {
    if (!title) return '';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  // Function to get segment identifier
  const getSegmentId = (d) => {
    return d.ancestors().map(ancestor => ancestor.data.name).join(' > ');
  };

  // Function to toggle hold on a segment
  const toggleHold = (segmentId) => {
    if (heldSegments.value.has(segmentId)) {
      heldSegments.value.delete(segmentId);
    } else {
      heldSegments.value.add(segmentId);
    }
  };

  // Function to clear all holds
  const clearHolds = () => {
    heldSegments.value.clear();
  };

  // Function to check if a segment is held
  const isSegmentHeld = (d) => {
    const segmentId = getSegmentId(d);
    return heldSegments.value.has(segmentId);
  };

  // Function to handle node click and show info card
  const handleNodeClick = (d) => {
    // Get the path components
    const pathComponents = d.ancestors().map(ancestor => ancestor.data.name).reverse();
    const projectName = pathComponents[0] || '';
    const phase = pathComponents[1] || '';
    const task = pathComponents[2] || '';
    const subTask = pathComponents[3] || '';
    
    const nodeInfo = {
      name: d.data.name,
      depth: d.depth,
      projectName: projectName,
      phase: phase,
      task: task,
      subTask: subTask,
      description: d.data.description || '',
      groups: d.data.groups || '',
      architecture: d.data.architecture || '',
      timeline_progress: d.data.timeline_progress || '',
      status: d.data.status || '',
      assigned_to: d.data.assigned_to || '',
      start_date: d.data.start_date || '',
      end_date: d.data.end_date || '',
      duration: d.data.duration || '',
      isHeld: isSegmentHeld(d)
    };
    
    selectedNodeInfo.value = nodeInfo;
    showInfoCard.value = true;
  };

  // Function to close info card
  const closeInfoCard = () => {
    showInfoCard.value = false;
    selectedNodeInfo.value = null;
  };

  // Function to format dates
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Function to get status class for styling
  const getStatusClass = (status) => {
    if (!status) return '';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('completed') || statusLower.includes('done')) return 'status-completed';
    if (statusLower.includes('in progress') || statusLower.includes('ongoing')) return 'status-progress';
    if (statusLower.includes('pending') || statusLower.includes('waiting')) return 'status-pending';
    if (statusLower.includes('blocked') || statusLower.includes('stopped')) return 'status-blocked';
    return 'status-default';
  };

  // Function to merge Tasks and Plans data
  const mergeTaskAndPlanData = (taskData, planData) => {
    const mergedData = [];
    
    const planMap = new Map();
    planData.forEach(plan => {
      const keys = [
        `${plan.project_name || ''}_${plan.phase || ''}_${plan.task || ''}_${plan.sub_task || ''}`.toLowerCase(),
        `${plan.project_name || ''}_${plan.phase || ''}_${plan.task || ''}`.toLowerCase(),
        `${plan.project_name || ''}_${plan.phase || ''}`.toLowerCase(),
        `${plan.project_name || ''}`.toLowerCase()
      ];
      
      keys.forEach(key => {
        if (key && key !== '___') {
          planMap.set(key, plan);
        }
      });
    });
    
    taskData.forEach((task, index) => {
      // Try multiple matching strategies
      const possibleKeys = [
        `${task.project_name || ''}_${task.phase || ''}_${task.task || ''}_${task.sub_task || ''}`.toLowerCase(),
        `${task.project_name || ''}_${task.phase || ''}_${task.task || ''}`.toLowerCase(),
        `${task.project_name || ''}_${task.phase || ''}`.toLowerCase(),
        `${task.project_name || ''}`.toLowerCase()
      ];
      
      let matchingPlan = null;
      let matchedKey = null;
      for (const key of possibleKeys) {
        if (key && key !== '___' && planMap.has(key)) {
          matchingPlan = planMap.get(key);
          matchedKey = key;
          break;
        }
      }
      
      const mergedTask = {
        ...task,
        timeline_progress: matchingPlan?.timeline_progress || '',
        status: matchingPlan?.status || '',
        assigned_to: matchingPlan?.assigned_to || '',
        start_date: matchingPlan?.start_date || '',
        end_date: matchingPlan?.end_date || '',
        duration: matchingPlan?.duration || '',
        architecture: task.architecture || ''
      };
      
      mergedData.push(mergedTask);
    });
    
    return mergedData;
  };

  // Transform task data into hierarchical structure for sunburst chart
  const transformTaskData = (taskData, selectedProject) => {
    if (!taskData || !selectedProject) {
      return {
        name: "Select a Project",
        children: []
      };
    }

    // Filter tasks for the selected project
    const projectTasks = taskData.filter(task => 
      task.project_name && task.project_name.toLowerCase() === selectedProject.toLowerCase()
    );

    if (projectTasks.length === 0) {
      return {
        name: selectedProject,
        children: [{
          name: "No tasks found for this project",
          value: 1
        }]
      };
    }

    // Group by phases
    const phaseGroups = {};
    projectTasks.forEach(task => {
      const phase = task.phase || 'Uncategorized';
      if (!phaseGroups[phase]) {
        phaseGroups[phase] = {};
      }
      
      // Group by tasks within phases
      const taskName = task.task || 'Uncategorized';
      if (!phaseGroups[phase][taskName]) {
        phaseGroups[phase][taskName] = [];
      }
      
      // Add subtasks
      if (task.sub_task) {
        phaseGroups[phase][taskName].push({
          name: task.sub_task,
          value: 1,
          description: task.description || '',
          groups: task.groups || '',
          architecture: task.architecture || '',
          timeline_progress: task.timeline_progress || '',
          status: task.status || '',
          assigned_to: task.assigned_to || '',
          start_date: task.start_date || '',
          end_date: task.end_date || '',
          duration: task.duration || ''
        });
      }
    });

    // Convert to hierarchical structure
    const children = Object.entries(phaseGroups).map(([phaseName, tasks]) => ({
      name: phaseName,
      children: Object.entries(tasks).map(([taskName, subtasks]) => ({
        name: taskName,
        children: subtasks.length > 0 ? subtasks : [{ name: 'No subtasks', value: 1 }]
      }))
    }));

    // Ensure we have at least one child
    if (children.length === 0) {
      children.push({
        name: 'No phases found',
        children: [{ name: 'No tasks found', value: 1 }]
      });
    }

    return {
      name: selectedProject,
      children: children
    };
  };

  // Computed property for chart data based on selected project
  const chartData = computed(() => {
    if (props.selectedProject && sunburstStore.taskData.length > 0) {
      return transformTaskData(sunburstStore.taskData, props.selectedProject);
    }
    // Return a default structure when no project is selected
    return {
      name: "Select a Project",
      children: [{
        name: "Choose a project from the dropdown above",
        value: 1
      }]
    };
  });

  watch(
    () => sunburstStore.taskData,
    (source) => {
      if (chartContainer.value) {
        createSunburstChart();
        createLegendItems();
      }
    },
    {immediate: true, deep: true}
  )

  watch(
    () => props.selectedProject,
    (source) => {
      if (chartContainer.value) {
        // Reset chart history when project changes
        chartHistory.value = [];
        currentRoot.value = null;
        createSunburstChart();
        createLegendItems();
      }
    },
    {immediate: true, deep: true}
  )

  let zoomTo;

  function createSunburstChart() {
    const partition = data => {
      const root = d3
          .hierarchy(data)
          .sum(d => d.value)
          .sort((a, b) => b.value - a.value);
      return d3.partition().size([2 * Math.PI, root.height + 1])(root);
    };

    const root = partition(chartData.value);
    currentRoot.value = root;

    root.each(d => (d.current = d));

    const width = 932;

    const svg = d3
        .create("svg")
        .attr('width', width.value)
        .attr('height', height.value)
        .attr("viewBox", [0, 0, width, width])
        .style("font", "14px sans-serif bold");

    const g = svg
        .append("g")
        .attr("transform", `translate(${width / 2},${width / 2})`);

    const color = d3.scaleOrdinal(
        d3.quantize(d3.interpolateRainbow, chartData.value.children.length + 1)
    );

    const radius = width / 6;

    const arc = d3
        .arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    const path = g
        .append("g")
        .selectAll("path")
        .data(root.descendants().slice(1))
        .join("path")
        .attr("fill", d => {
          while (d.depth > 1) d = d.parent;
          return color(d.data.name);
        })
        .attr("fill-opacity", d =>
            arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0
        )
        .attr("d", d => arc(d.current))
        .attr("stroke", d => isSegmentHeld(d) ? "#000" : "none")
        .attr("stroke-width", d => isSegmentHeld(d) ? 3 : 0)
        .on("mouseover", function(event, d) {
          selectedItem.value = {
            name: d.data.name,
            depth: d.depth,
            value: d.value,
            description: d.data.description || ''
          };
        })
        .on("contextmenu", function(event, d) {
          event.preventDefault();
          const segmentId = getSegmentId(d);
          toggleHold(segmentId);
          // Update visual indicators
          d3.select(this)
            .attr("stroke", isSegmentHeld(d) ? "#000" : "none")
            .attr("stroke-width", isSegmentHeld(d) ? 3 : 0);
        })
        .on("click", function(event, d) {
          event.preventDefault();
          handleNodeClick(d);
        });

    path
        .filter(d => d.children)
        .style("cursor", "pointer")
        .on("click", clicked);

    const format = d3.format(",d");

    path.append("title").text(
        d =>
            `${d
                .ancestors()
                .map(d => d.data.name)
                .reverse()
                .join("/")}\n${format(d.value)}`
    );

    const label = g
        .append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
        .selectAll("text")
        .data(root.descendants().slice(1))
        .join("text")
        .attr("dy", "0.35em")
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .text(d => processTitle(d.data.name));

    const centerGroup = g.append("g");
    
    const parent = centerGroup
        .append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    const centerText = centerGroup
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .text(processTitle(chartData.value.name, 20));

    function updateCenterText() {
      centerText.text(processTitle(chartData.value.name, 20));
    }

    updateCenterText();

    const undoButton = centerGroup
        .append("g")
        .attr("class", "undo-button")
        .style("opacity", 0)
        .style("cursor", "pointer")
        .on("click", undoZoom);

    undoButton
        .append("circle")
        .attr("r", 35)
        .attr("fill", "rgba(255, 255, 255, 0.9)")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1);

    undoButton
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-size", "30px")
        .text("↶");

    centerGroup
        .on("mouseenter", function() {
          if (currentRoot.value && currentRoot.value.parent) {
            d3.select(this).select(".undo-button").style("opacity", 1);
          }
        })
        .on("mouseleave", function() {
          d3.select(this).select(".undo-button").style("opacity", 0);
        });

    function clicked(event, p) {
      // Save current state to history
      if (currentRoot.value) {
        chartHistory.value.push(currentRoot.value);
      }

      parent.datum(p.parent || root);
      currentRoot.value = p.parent || root;

      root.each(
          d =>
              (d.target = {
                x0:
                    Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) *
                    2 *
                    Math.PI,
                x1:
                    Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) *
                    2 *
                    Math.PI,
                y0: Math.max(0, d.y0 - p.depth),
                y1: Math.max(0, d.y1 - p.depth)
              })
      );

      const t = g.transition().duration(750);

      // Transition the data on all arcs, even the ones that aren't visible,
      // so that if this transition is interrupted, entering arcs will start
      // the next transition from the desired position.
      path
          .transition(t)
          .tween("data", d => {
            const i = d3.interpolate(d.current, d.target);
            return t => (d.current = i(t));
          })
          .filter(function(d) {
            return +this.getAttribute("fill-opacity") || arcVisible(d.target);
          })
          .attr("fill-opacity", d =>
              arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0
          )
          .attrTween("d", d => () => arc(d.current))
          .attr("stroke", d => isSegmentHeld(d) ? "#000" : "none")
          .attr("stroke-width", d => isSegmentHeld(d) ? 3 : 0);

      label
          .filter(function(d) {
            return +this.getAttribute("fill-opacity") || labelVisible(d.target);
          })
          .transition(t)
          .attr("fill-opacity", d => +labelVisible(d.target))
          .attrTween("transform", d => () => labelTransform(d.current));
    }

    function undoZoom() {
      if (chartHistory.value.length > 0) {
        const previousRoot = chartHistory.value.pop();
        currentRoot.value = previousRoot;
        parent.datum(previousRoot);
        
        root.each(
            d =>
                (d.target = {
                  x0:
                      Math.max(0, Math.min(1, (d.x0 - previousRoot.x0) / (previousRoot.x1 - previousRoot.x0))) *
                      2 *
                      Math.PI,
                  x1:
                      Math.max(0, Math.min(1, (d.x1 - previousRoot.x0) / (previousRoot.x1 - previousRoot.x0))) *
                      2 *
                      Math.PI,
                  y0: Math.max(0, d.y0 - previousRoot.depth),
                  y1: Math.max(0, d.y1 - previousRoot.depth)
                })
        );

        const t = g.transition().duration(750);
                
        path
            .transition(t)
            .tween("data", d => {
              const i = d3.interpolate(d.current, d.target);
              return t => (d.current = i(t));
            })
            .filter(function(d) {
              return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
            .attr("fill-opacity", d =>
                arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0
            )
            .attrTween("d", d => () => arc(d.current))
            .attr("stroke", d => isSegmentHeld(d) ? "#000" : "none")
            .attr("stroke-width", d => isSegmentHeld(d) ? 3 : 0);

        label
            .filter(function(d) {
              return +this.getAttribute("fill-opacity") || labelVisible(d.target);
            })
            .transition(t)
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
      }
    }

    function arcVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
      const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
      const y = ((d.y0 + d.y1) / 2) * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

    if (chartContainer.value) {
      // Clear existing content
      chartContainer.value.innerHTML = '';
      chartContainer.value.appendChild(svg.node());
    }

  }

  function createLegendItems() {
    const items = [];
    if (chartData.value.children) {
      const colorScale = d3.scaleOrdinal(
        d3.quantize(d3.interpolateRainbow, chartData.value.children.length + 1)
      );
      chartData.value.children.forEach(child => {
        items.push({
          key: child.name,
          name: child.name,
          color: colorScale(child.name)
        });
      });
    }
    legendItems.value = items;
  }

  defineExpose({
    toggleHold,
    clearHolds,
    heldSegments,
    handleNodeClick,
    closeInfoCard,
    formatDate,
    getStatusClass
  });
</script>

<template>
  <div style="min-height: 625px">
    <div ref="chartContainer" class="sunburst-chart"></div>
    <div class="selected-info" v-if="selectedItem">
      <strong>Selected:</strong> {{ selectedItem.name }}<br/>
      <strong>Depth:</strong> {{ selectedItem.depth }}<br/>
      <strong>Value:</strong> {{ selectedItem.value }}
      <div v-if="selectedItem.description" class="description">
        <strong>Description:</strong> {{ selectedItem.description }}
      </div>
    </div>
    <div class="legend">
      <div v-for="item in legendItems" :key="item.key" class="legend-item">
        <span class="legend-color" :style="{backgroundColor: item.color}"></span>
        <span class="legend-label">{{ item.name }}</span>
      </div>
    </div>
    
    <div v-if="showInfoCard" class="info-card-overlay" @click="closeInfoCard">
      <div class="info-card" @click.stop>
        <div class="info-card-header">
          <h3>{{ selectedNodeInfo?.name }}</h3>
          <button @click="closeInfoCard" class="close-btn">×</button>
        </div>
        <div class="info-card-content">
          <div class="info-section">
            <strong>Project:</strong> {{ selectedNodeInfo?.projectName }}
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.phase">
            <strong>Phase:</strong> {{ selectedNodeInfo?.phase }}
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.task">
            <strong>Task:</strong> {{ selectedNodeInfo?.task }}
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.timeline_progress">
            <strong>Progress:</strong> {{ selectedNodeInfo?.timeline_progress }}%
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.status">
            <strong>Status:</strong> 
            <span class="status-badge" :class="getStatusClass(selectedNodeInfo?.status)">
              {{ selectedNodeInfo?.status }}
            </span>
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.assigned_to">
            <strong>Assigned To:</strong> {{ selectedNodeInfo?.assigned_to }}
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.start_date">
            <strong>Start Date:</strong> {{ formatDate(selectedNodeInfo?.start_date) }}
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.end_date">
            <strong>End Date:</strong> {{ formatDate(selectedNodeInfo?.end_date) }}
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.duration">
            <strong>Duration:</strong> {{ selectedNodeInfo?.duration }}
          </div>
          <div class="info-section" v-if="selectedNodeInfo?.isHeld">
            <strong>Hold Status:</strong> <span class="held-status">✓ Held</span>
          </div>
          <div class="info-section">
            <strong>Description:</strong>
            <p v-if="selectedNodeInfo?.description" class="description-text">{{ selectedNodeInfo?.description }}</p>
            <p v-else class="no-info-text">No description available</p>
          </div>
          <div class="info-section">
            <strong>Groups:</strong>
            <p v-if="selectedNodeInfo?.groups" class="groups-text">{{ selectedNodeInfo?.groups }}</p>
            <p v-else class="no-info-text">No groups assigned</p>
          </div>
          <div class="info-section">
            <strong>Architecture:</strong>
            <p v-if="selectedNodeInfo?.architecture" class="architecture-text">{{ selectedNodeInfo?.architecture }}</p>
            <p v-else class="no-info-text">No architecture information available</p>
          </div>
        </div>
        <div class="info-card-actions">
          <button @click="closeInfoCard" class="close-info-btn">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .sunburst-chart {
    margin-bottom: 16px;
    width: 100%;
    aspect-ratio: 1 / 1;
    position: relative;
  }
  .sunburst-chart > svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100% !important;
    height: 100% !important;
  }
  .selected-info {
    margin-bottom: 16px;
    font-size: 16px;
  }
  .description {
    margin-top: 8px;
    font-style: italic;
    color: #666;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 16px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
  }
  .legend-color {
    width: 16px;
    height: 16px;
    display: inline-block;
    margin-right: 8px;
    border-radius: 3px;
    border: 1px solid #ccc;
  }
  .legend-label {
    font-size: 14px;
  }
  
  .hold-controls {
    margin-bottom: 16px;
    padding: 16px;
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }
  
  .hold-info {
    margin-bottom: 12px;
  }
  
  .hold-info ul {
    margin: 8px 0;
    padding-left: 20px;
  }
  
  .hold-info li {
    margin-bottom: 4px;
    font-size: 14px;
    color: #666;
  }
  
  .hold-actions {
    margin-bottom: 12px;
  }
  
  .clear-holds-btn {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  .clear-holds-btn:hover {
    background-color: #c82333;
  }
  
  .held-segments {
    margin-top: 12px;
  }
  
  .held-segments ul {
    margin: 8px 0;
    padding-left: 20px;
  }
  
  .held-segments li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    padding: 4px 8px;
    background-color: #e9ecef;
    border-radius: 4px;
    font-size: 14px;
  }
  
  .remove-hold-btn {
    background-color: #6c757d;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .remove-hold-btn:hover {
    background-color: #5a6268;
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
    padding: 20px 24px 16px;
    border-bottom: 1px solid #e9ecef;
  }
  
  .info-card-header h3 {
    margin: 0;
    color: #333;
    font-size: 20px;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }
  
  .close-btn:hover {
    background-color: #f8f9fa;
    color: #333;
  }
  
  .info-card-content {
    padding: 20px 24px;
  }
  
  .info-section {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f8f9fa;
  }
  
  .info-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
  
  .info-section strong {
    color: #495057;
    font-weight: 600;
    display: inline-block;
    min-width: 100px;
  }
  
  .held-status {
    color: #28a745;
    font-weight: 600;
  }
  
  .status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .status-completed {
    background-color: #d4edda;
    color: #155724;
  }
  
  .status-progress {
    background-color: #cce5ff;
    color: #004085;
  }
  
  .status-pending {
    background-color: #fff3cd;
    color: #856404;
  }
  
  .status-blocked {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .status-default {
    background-color: #e9ecef;
    color: #495057;
  }
  
  .description-text {
    margin: 8px 0 0 0;
    color: #666;
    line-height: 1.5;
    font-style: italic;
  }
  
  .groups-text {
    margin: 8px 0 0 0;
    color: #666;
    line-height: 1.5;
  }
  
  .architecture-text {
    margin: 8px 0 0 0;
    color: #666;
    line-height: 1.5;
  }
  
  .no-info-text {
    margin: 8px 0 0 0;
    color: #999;
    line-height: 1.5;
    font-style: italic;
  }
  
  .info-card-actions {
    padding: 16px 24px 20px;
    border-top: 1px solid #e9ecef;
    text-align: right;
  }
  
  .close-info-btn {
    background-color: #6c757d;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  }
  
  .close-info-btn:hover {
    background-color: #5a6268;
  }
</style>