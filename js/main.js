/* CS 416 Narrative Visualization — Interactive Slideshow
 * Parameters drive scene state; triggers update parameters and redraw.
 */

const params = {
  sceneIndex: 0,
  metric: "highway", // "highway" | "city"
  selectedFuel: "All",
  selectedMake: "All"
};

const fuelColors = {
  Gasoline: "#4c78a8",
  Diesel: "#f58518",
  Electricity: "#54a24b"
};

const stepLabels = ["Fuel Types", "Engine Size", "Explore"];

const margin = { top: 36, right: 28, bottom: 52, left: 62 };
let data = [];
let width = 900;
let height = 460;

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");

const metricAccessor = (d) =>
  params.metric === "city" ? d.AverageCityMPG : d.AverageHighwayMPG;

const metricLabel = () =>
  params.metric === "city" ? "City MPG / MPGe" : "Highway MPG / MPGe";

const metricShort = () =>
  params.metric === "city" ? "City" : "Highway";

function sceneTwoDescription() {
  const metricText =
    params.metric === "city" ? "city efficiency" : "highway efficiency";
  return `Among gasoline and diesel vehicles, ${metricText} generally decreases as engine cylinder count rises. Electric cars sit at 0 cylinders with the highest values.`;
}

function getSceneMeta() {
  if (params.sceneIndex === 0) {
    return {
      title: "Fuel Type Sets the Efficiency Baseline",
      description:
        "Electric vehicles average far higher MPG / MPGe than gasoline or diesel across the 2017 configuration summary.",
      hint: "Hover bars for exact averages. Use Efficiency metric to switch Highway / City. Then click Next."
    };
  }
  if (params.sceneIndex === 1) {
    return {
      title: "Among Combustion Vehicles, More Cylinders Usually Mean Lower MPG",
      description: sceneTwoDescription(),
      hint: "Filter by fuel type to isolate trends. Hover points for make and MPG / MPGe details."
    };
  }
  return {
    title: "Explore City vs Highway Efficiency",
    description:
      "Compare configurations freely: city and highway values move together, while fuel type separates the clusters.",
    hint: "Filter by fuel and brand, then hover any point. Use Reset Filters to return to the full dataset."
  };
}

function filteredData() {
  return data.filter((d) => {
    const fuelOk =
      params.selectedFuel === "All" || d.Fuel === params.selectedFuel;
    const makeOk =
      params.selectedMake === "All" || d.Make === params.selectedMake;
    return fuelOk && makeOk;
  });
}

function isNarrow() {
  return width < 700;
}

function clearChart() {
  svg.selectAll("*").remove();
  tooltip.attr("hidden", true);
  d3.select("#emptyState").attr("hidden", true).text("");
}

function chartSize() {
  const wrap = document.querySelector(".chart-wrap");
  width = wrap.clientWidth || 900;
  height = isNarrow() ? 400 : 460;
  svg.attr("viewBox", `0 0 ${width} ${height}`);
}

function fadeIn(g) {
  g.attr("opacity", 0)
    .transition()
    .duration(350)
    .attr("opacity", 1);
}

function showTooltip(event, html) {
  const wrap = document.querySelector(".chart-wrap");
  const tipW = 220;
  let left = event.offsetX + 14;
  let top = event.offsetY + 10;
  if (left + tipW > wrap.clientWidth) left = event.offsetX - tipW - 8;
  if (top + 80 > wrap.clientHeight) top = event.offsetY - 70;

  tooltip
    .html(html)
    .attr("hidden", null)
    .style("left", `${Math.max(4, left)}px`)
    .style("top", `${Math.max(4, top)}px`);
}

function hideTooltip() {
  tooltip.attr("hidden", true);
}

function bindDotHover(selection, htmlFn) {
  selection
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("r", 8).attr("stroke-width", 2);
      showTooltip(event, htmlFn(d));
    })
    .on("mousemove", function (event, d) {
      showTooltip(event, htmlFn(d));
    })
    .on("mouseleave", function () {
      d3.select(this).attr("r", 5.5).attr("stroke-width", 1);
      hideTooltip();
    });
}

/** Shared annotation template: dashed leader + rounded label box */
function drawAnnotation(g, { x1, y1, x2, y2, lines, boxWidth }) {
  const lineHeight = isNarrow() ? 13 : 15;
  const padX = 8;
  const padY = 7;
  const boxH = padY * 2 + lines.length * lineHeight;
  const safeWidth = Math.min(boxWidth, Math.max(140, width - margin.left - margin.right - 40));
  let boxX = x2;
  if (boxX + safeWidth > width - margin.left - margin.right) {
    boxX = Math.max(0, width - margin.left - margin.right - safeWidth);
  }
  const boxY = Math.max(4, Math.min(y2 - boxH / 2, height - margin.top - margin.bottom - boxH - 4));

  g.append("path")
    .attr("class", "annotation-line")
    .attr("d", `M${x1},${y1} L${boxX},${boxY + boxH / 2}`);

  g.append("rect")
    .attr("class", "annotation-box")
    .attr("x", boxX)
    .attr("y", boxY)
    .attr("width", safeWidth)
    .attr("height", boxH)
    .attr("rx", 5);

  lines.forEach((text, i) => {
    g.append("text")
      .attr("class", "annotation-text")
      .attr("x", boxX + padX)
      .attr("y", boxY + padY + (i + 0.8) * lineHeight)
      .text(text);
  });
}

function drawFuelLegend(g, xPos, yPos) {
  const fuels = ["Gasoline", "Diesel", "Electricity"];
  const gap = isNarrow() ? 88 : 110;
  const legend = g
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${xPos},${yPos})`);

  fuels.forEach((fuel, i) => {
    const row = legend.append("g").attr("transform", `translate(${i * gap}, 0)`);
    row
      .append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("rx", 2)
      .attr("fill", fuelColors[fuel]);
    row.append("text").attr("x", 18).attr("y", 10).text(fuel);
  });
}

function showEmptyState(message) {
  d3.select("#emptyState").attr("hidden", null).text(message);
}

/* ---------- Scene 1: Fuel overview bars ---------- */
function renderSceneFuelOverview() {
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  fadeIn(g);

  const fuels = ["Gasoline", "Diesel", "Electricity"];
  const averages = fuels.map((fuel) => {
    const subset = data.filter((d) => d.Fuel === fuel);
    return {
      Fuel: fuel,
      value: d3.mean(subset, metricAccessor),
      n: subset.length
    };
  });

  const x = d3.scaleBand().domain(fuels).range([0, innerW]).padding(0.28);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(averages, (d) => d.value) * 1.12])
    .nice()
    .range([innerH, 0]);

  const tickCount = isNarrow() ? 4 : 6;

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(tickCount));

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -46)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6c7b")
    .attr("font-size", 12)
    .text(metricLabel());

  g.selectAll(".bar")
    .data(averages)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.Fuel))
    .attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", (d) => innerH - y(d.value))
    .attr("fill", (d) => fuelColors[d.Fuel])
    .attr("opacity", 0.92)
    .on("mousemove", (event, d) => {
      showTooltip(
        event,
        `<strong>${d.Fuel}</strong><br>${metricLabel()}: ${d.value.toFixed(1)}<br>Configs: ${d.n}`
      );
    })
    .on("mouseleave", hideTooltip);

  g.selectAll(".bar-label")
    .data(averages)
    .join("text")
    .attr("x", (d) => x(d.Fuel) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.value) - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "#1f2933")
    .text((d) => d.value.toFixed(1));

  const ev = averages.find((d) => d.Fuel === "Electricity");
  const gas = averages.find((d) => d.Fuel === "Gasoline");
  drawAnnotation(g, {
    x1: x("Electricity") + x.bandwidth() / 2,
    y1: y(ev.value) + 8,
    x2: Math.min(x("Electricity") + x.bandwidth() + 18, innerW - 210),
    y2: y(ev.value) + 40,
    boxWidth: 200,
    lines: [
      "Electricity leads by a wide margin",
      `~${(ev.value / gas.value).toFixed(1)}× gasoline average`
    ]
  });
}

/* ---------- Scene 2: Cylinders vs efficiency ---------- */
function renderSceneCylinders() {
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  fadeIn(g);

  const plotData = filteredData();
  if (!plotData.length) {
    showEmptyState(
      'No configurations match these filters. Select "All" or reset the filters.'
    );
    return;
  }

  const x = d3
    .scaleLinear()
    .domain([-0.5, d3.max(data, (d) => d.EngineCylinders) + 0.5])
    .range([0, innerW]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, metricAccessor) * 1.05])
    .nice()
    .range([innerH, 0]);

  const tickCount = isNarrow() ? 5 : 8;

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(tickCount));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(isNarrow() ? 5 : 7));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6c7b")
    .attr("font-size", 12)
    .text("Engine Cylinders");

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -46)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6c7b")
    .attr("font-size", 12)
    .text(metricLabel());

  const trendSource = plotData.filter((d) => d.Fuel !== "Electricity");
  if (trendSource.length >= 2) {
    const xMean = d3.mean(trendSource, (d) => d.EngineCylinders);
    const yMean = d3.mean(trendSource, metricAccessor);
    const denom = d3.sum(trendSource, (d) => (d.EngineCylinders - xMean) ** 2);
    if (denom > 0) {
      const slope =
        d3.sum(
          trendSource,
          (d) => (d.EngineCylinders - xMean) * (metricAccessor(d) - yMean)
        ) / denom;
      const intercept = yMean - slope * xMean;
      const x0 = d3.min(trendSource, (d) => d.EngineCylinders);
      const x1 = d3.max(trendSource, (d) => d.EngineCylinders);

      g.append("line")
        .attr("x1", x(x0))
        .attr("y1", y(intercept + slope * x0))
        .attr("x2", x(x1))
        .attr("y2", y(intercept + slope * x1))
        .attr("stroke", "#8896a6")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "6 4");
    }
  }

  const dots = g
    .selectAll(".dot")
    .data(plotData)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(d.EngineCylinders))
    .attr("cy", (d) => y(metricAccessor(d)))
    .attr("r", 5.5)
    .attr("fill", (d) => fuelColors[d.Fuel])
    .attr("opacity", 0.8)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  bindDotHover(
    dots,
    (d) =>
      `<strong>${d.Make}</strong><br>Fuel: ${d.Fuel}<br>Cylinders: ${d.EngineCylinders}<br>Highway MPG/MPGe: ${d.AverageHighwayMPG}<br>City MPG/MPGe: ${d.AverageCityMPG}`
  );

  drawFuelLegend(g, Math.max(0, innerW - (isNarrow() ? 270 : 320)), -18);

  const evs = plotData.filter((d) => d.Fuel === "Electricity");
  if (evs.length) {
    const evY = d3.mean(evs, metricAccessor);
    drawAnnotation(g, {
      x1: x(0) + 6,
      y1: y(evY),
      x2: x(2.2),
      y2: y(evY) - 10,
      boxWidth: 186,
      lines: ["EVs at 0 cylinders", "top of the efficiency range"]
    });
  } else {
    const highCyl = plotData
      .filter((d) => d.EngineCylinders >= 8)
      .sort((a, b) => metricAccessor(a) - metricAccessor(b))[0];
    if (highCyl) {
      drawAnnotation(g, {
        x1: x(highCyl.EngineCylinders),
        y1: y(metricAccessor(highCyl)),
        x2: x(4.5),
        y2: y(58),
        boxWidth: 180,
        lines: ["High-cylinder engines", "cluster at lower MPG"]
      });
    }
  }

  if (params.selectedFuel === "All") {
    drawAnnotation(g, {
      x1: x(10),
      y1: y(20),
      x2: x(6.5),
      y2: y(55),
      boxWidth: 188,
      lines: [
        "Trend: more cylinders,",
        `lower ${metricShort().toLowerCase()} MPG / MPGe`
      ]
    });
  }
}

/* ---------- Scene 3: City vs Highway explore ---------- */
function renderSceneExplore() {
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  fadeIn(g);

  const plotData = filteredData();
  const maxVal = d3.max(data, (d) => Math.max(d.AverageCityMPG, d.AverageHighwayMPG));

  const x = d3.scaleLinear().domain([0, maxVal * 1.05]).nice().range([0, innerW]);
  const y = d3.scaleLinear().domain([0, maxVal * 1.05]).nice().range([innerH, 0]);
  const tickCount = isNarrow() ? 5 : 8;

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(tickCount));

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(tickCount));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6c7b")
    .attr("font-size", 12)
    .text("City MPG / MPGe");

  g.append("text")
    .attr("x", -innerH / 2)
    .attr("y", -46)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "#5f6c7b")
    .attr("font-size", 12)
    .text("Highway MPG / MPGe");

  g.append("line")
    .attr("x1", x(0))
    .attr("y1", y(0))
    .attr("x2", x(maxVal))
    .attr("y2", y(maxVal))
    .attr("stroke", "#cfd6e0")
    .attr("stroke-dasharray", "4 4");

  if (!plotData.length) {
    showEmptyState(
      'No configurations match these filters. Select "All" or reset the filters.'
    );
    return;
  }

  const dots = g
    .selectAll(".dot")
    .data(plotData)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(d.AverageCityMPG))
    .attr("cy", (d) => y(d.AverageHighwayMPG))
    .attr("r", 5.5)
    .attr("fill", (d) => fuelColors[d.Fuel])
    .attr("opacity", 0.82)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  bindDotHover(
    dots,
    (d) =>
      `<strong>${d.Make}</strong><br>Fuel: ${d.Fuel}<br>Cylinders: ${d.EngineCylinders}<br>City MPG/MPGe: ${d.AverageCityMPG}<br>Highway MPG/MPGe: ${d.AverageHighwayMPG}`
  );

  drawFuelLegend(g, 8, -18);

  const evs = plotData.filter((d) => d.Fuel === "Electricity");
  if (evs.length) {
    const anchor = evs.slice().sort((a, b) => a.AverageCityMPG - b.AverageCityMPG)[0];
    drawAnnotation(g, {
      x1: x(anchor.AverageCityMPG),
      y1: y(anchor.AverageHighwayMPG),
      x2: x(48),
      y2: y(125),
      boxWidth: 196,
      lines: [
        "Electric cluster: high city",
        "and highway MPG / MPGe"
      ]
    });
  } else {
    const focus = plotData.reduce((best, d) =>
      d.AverageCityMPG + d.AverageHighwayMPG >
      best.AverageCityMPG + best.AverageHighwayMPG
        ? d
        : best
    );
    drawAnnotation(g, {
      x1: x(focus.AverageCityMPG),
      y1: y(focus.AverageHighwayMPG),
      x2: x(95),
      y2: y(130),
      boxWidth: 170,
      lines: ["Filtered view active", "hover points to compare"]
    });
  }
}

/* ---------- Controls + scene orchestration ---------- */
function resetExploreFilters() {
  params.selectedFuel = "All";
  params.selectedMake = "All";
  update();
}

function renderControls() {
  const controls = d3.select("#controls");
  controls.html("");

  if (params.sceneIndex === 0) {
    controls.append("label").text("Efficiency metric:");
    ["highway", "city"].forEach((m) => {
      controls
        .append("button")
        .attr("type", "button")
        .attr("class", `metric-btn${params.metric === m ? " active" : ""}`)
        .text(m === "highway" ? "Highway" : "City")
        .on("click", () => {
          params.metric = m;
          update();
        });
    });
    return;
  }

  controls.append("label").text("Fuel:");
  ["All", "Gasoline", "Diesel", "Electricity"].forEach((fuel) => {
    controls
      .append("button")
      .attr("type", "button")
      .attr("class", `fuel-btn${params.selectedFuel === fuel ? " active" : ""}`)
      .text(fuel)
      .on("click", () => {
        params.selectedFuel = fuel;
        update();
      });
  });

  if (params.sceneIndex === 1) {
    controls.append("label").style("margin-left", "8px").text("Efficiency metric:");
    ["highway", "city"].forEach((m) => {
      controls
        .append("button")
        .attr("type", "button")
        .attr("class", `metric-btn${params.metric === m ? " active" : ""}`)
        .text(m === "highway" ? "Highway" : "City")
        .on("click", () => {
          params.metric = m;
          update();
        });
    });
  }

  if (params.sceneIndex === 2) {
    const makes = ["All", ...Array.from(new Set(data.map((d) => d.Make))).sort()];
    controls.append("label").style("margin-left", "8px").text("Make:");
    const select = controls.append("select").attr("id", "makeSelect");
    select
      .selectAll("option")
      .data(makes)
      .join("option")
      .attr("value", (d) => d)
      .property("selected", (d) => d === params.selectedMake)
      .text((d) => d);

    select.on("change", (event) => {
      params.selectedMake = event.target.value;
      update();
    });

    controls
      .append("button")
      .attr("type", "button")
      .attr("class", "reset-btn")
      .text("Reset Filters")
      .on("click", resetExploreFilters);

    const shown = filteredData().length;
    controls
      .append("p")
      .attr("class", "filter-status")
      .text(`Showing ${shown} of ${data.length} configurations`);
  }
}

function renderScene() {
  clearChart();
  chartSize();

  if (params.sceneIndex === 0) renderSceneFuelOverview();
  else if (params.sceneIndex === 1) renderSceneCylinders();
  else renderSceneExplore();
}

function renderMeta() {
  const scene = getSceneMeta();
  d3.select("#sceneLabel").text(`Scene ${params.sceneIndex + 1} of 3`);
  d3.select("#sceneTitle").text(scene.title);
  d3.select("#sceneDescription").text(scene.description);
  d3.select("#interactionHint").text(scene.hint);

  const takeaway = d3.select("#takeaway");
  if (params.sceneIndex === 2) {
    takeaway
      .attr("hidden", null)
      .html(
        "<strong>Key takeaway:</strong> Fuel type creates the clearest separation in efficiency. Among gasoline and diesel vehicles, configurations with more cylinders usually have lower MPG."
      );
  } else {
    takeaway.attr("hidden", true).html("");
  }

  d3.select("#prevBtn").property("disabled", params.sceneIndex === 0);
  d3.select("#nextBtn").property("disabled", params.sceneIndex === 2);

  d3.select("#stepIndicators")
    .selectAll("button")
    .data(stepLabels)
    .join("button")
    .attr("type", "button")
    .attr("class", (d, i) => `step-btn${i === params.sceneIndex ? " active" : ""}`)
    .attr("aria-label", (d, i) => `Go to scene ${i + 1}: ${d}`)
    .html(
      (d, i) =>
        `<span class="step-num">${i + 1}</span><span class="step-label">${d}</span>`
    )
    .on("click", (event, d) => {
      params.sceneIndex = stepLabels.indexOf(d);
      if (params.sceneIndex !== 2) params.selectedMake = "All";
      update();
    });
}

function update() {
  renderMeta();
  renderControls();
  renderScene();
}

function bindTriggers() {
  d3.select("#prevBtn").on("click", () => {
    if (params.sceneIndex > 0) {
      params.sceneIndex -= 1;
      params.selectedMake = "All";
      update();
    }
  });

  d3.select("#nextBtn").on("click", () => {
    if (params.sceneIndex < 2) {
      params.sceneIndex += 1;
      update();
    }
  });

  window.addEventListener("resize", () => {
    renderScene();
  });
}

d3.csv("cars2017.csv", (d) => ({
  Make: d.Make,
  Fuel: d.Fuel,
  EngineCylinders: +d.EngineCylinders,
  AverageHighwayMPG: +d.AverageHighwayMPG,
  AverageCityMPG: +d.AverageCityMPG
}))
  .then((rows) => {
    data = rows;
    bindTriggers();
    update();
  })
  .catch((err) => {
    d3.select("#sceneTitle").text("Could not load cars2017.csv");
    d3.select("#sceneDescription").text(
      "Serve this folder over HTTP (for example GitHub Pages or a local static server). Opening index.html as a file may block CSV loading."
    );
    console.error(err);
  });
