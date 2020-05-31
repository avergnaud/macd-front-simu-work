
var svg = d3.select("svg"),
    margin = {top: 20, right: 20, bottom: 110, left: 40},
    margin2 = {top: 430, right: 20, bottom: 30, left: 40},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom,
    height2 = 500- margin2.top - margin2.bottom;

svg.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

var x = d3.scaleTime().range([0, width]),
    x2 = d3.scaleTime().range([0, width]),
    y = d3.scaleLinear().range([height, 0]),
    y2 = d3.scaleLinear().range([height2, 0]);

var xAxis = d3.axisBottom(x),
    xAxis2 = d3.axisBottom(x2),
    yAxis = d3.axisLeft(y);

var brush = d3.brushX()
    .extent([[0, 0], [width, height2]])
    .on("brush end", brushed);

var zoom = d3.zoom()
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [width, height]])
    .extent([[0, 0], [width, height]])
    /*.on("zoom", zoomed)*/;

var closingPriceLine1 = d3.line()
  .curve(d3.curveMonotoneX)
  .x(function(d) { return x(d.date); })
  .y(function(d) { return y(d.closingPrice); });


var closingPriceLine2 = d3.line()
    .curve(d3.curveMonotoneX)
    .x(function(d) { return x2(d.date); })
    .y(function(d) { return y2(d.closingPrice); });

svg.append("defs").append("clipPath")
    .attr("id", "clip")
  .append("rect")
    .attr("width", width)
    .attr("height", height);

var focus = svg.append("g")
    .attr("class", "focus")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var context = svg.append("g")
    .attr("class", "context")
    .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");
	
var identity = d3.zoomIdentity;

const yAxisG = focus.append("g")
      .attr("class", "axis axis--y");

const yMargin = 30;

d3.json("http://localhost:8080/macd/?macdDefinitionId=9394", function(error, json) {
  if (error) throw error;

  /* skip the first incomplete items (before 12+26+9) */
  json = json.filter(item => (
    item.macdValue && item.signalValue
  ));

  let data = json.map(item => ({
    ...item,
    date: new Date(item.timeEpochTimestamp * 1000)
  }));

  zoom.on("zoom", () => zoomed(data));

  x.domain(d3.extent(data, function(d) { return d.date; }));
  let yMin = d3.min(data, d => d.closingPrice) - yMargin;
  let yMax = d3.max(data, d => d.closingPrice) + yMargin;
  y.domain([yMin, yMax]);
  x2.domain(x.domain());
  y2.domain(y.domain());

  focus.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("d", closingPriceLine1);

  focus.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  yAxisG.call(yAxis);

  context.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("d", closingPriceLine2);

  context.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height2 + ")")
      .call(xAxis2);

  context.append("g")
      .attr("class", "brush")
      .call(brush)
      .call(brush.move, x.range());

  svg.append("rect")
      .attr("class", "zoom")
      .attr("width", width)
      .attr("height", height)
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .call(zoom);
});

/*
updates the scale using d3.zoomIdentity, it must do this as it needs to update the 
zoom function to reflect the current zoom scale and transform.
*/
function brushed() {
  /* check to see if the main body of the function should be executed */
  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
  /* set a new x scale domain */
  var s = d3.event.selection || x2.range();
  x.domain(s.map(x2.invert, x2));
  /* update the closingPriceLine1 and axis */
  focus.select(".line").attr("d", closingPriceLine1);
  focus.select(".axis--x").call(xAxis);
  svg.select(".zoom").call(zoom.transform, d3.zoomIdentity
      .scale(width / (s[1] - s[0]))
      .translate(-s[0], 0));
	  
}

/*
manually sets the brush, it must do this because the brush needs to be updated.
*/
function zoomed(json) {

  /* check to see if the main body of the function should be executed */
  if (d3.event.sourceEvent && d3.event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
  /* set a new x scale domain */
  var t = d3.event.transform;
  transform = t;
  x.domain(t.rescaleX(x2).domain());

  /* visibleData: data to compute MACD */
  const [dateMin, dateMax] = x.domain();
  let visibleData = json.slice();
  visibleData.sort((a,b) => (a.timeEpochTimestamp - b.timeEpochTimestamp));
  visibleData = visibleData.filter((element, index) => (
    dateMin <= element.date && element.date <= dateMax
  ));
  /* updates y scale for the main graph */
  let yMin = d3.min(visibleData, d => d.closingPrice) - yMargin;
  let yMax = d3.max(visibleData, d => d.closingPrice) + yMargin;
  y.domain([yMin, yMax]);
  yAxisG.call(yAxis);

  /* update the closingPriceLine1 and axis */
  closingPriceLine1.y(function(d) { return y(d.closingPrice); });
  focus.select(".line").attr("d", closingPriceLine1);
  focus.select(".axis--x").call(xAxis);
  context.select(".brush").call(brush.move, x.range().map(t.invertX, t));

  let eurBalance;
  let cryptoBalance;
  let totalBalance;
  const initalBalance = 100;
  const fees = 0.0026;
  let isEur = visibleData[0].macdValue < visibleData[0].signalValue;
  /* initial balance */
  if(isEur) {
    eurBalance = initalBalance;
    cryptoBalance = 0;
  } else {
    eurBalance = 0;
    cryptoBalance = initalBalance / visibleData[0].closingPrice;
  }
  totalBalance = initalBalance;

  for(const item of visibleData) {
    let newIsEur = item.macdValue < item.signalValue;
    /* case 1 : same state */
    if(newIsEur === isEur) {
      continue;
    } else if (newIsEur) {
      /* case 2 : state change; SELL SIGNAL */
      let payedFees = (cryptoBalance * item.closingPrice) * fees;
      eurBalance = cryptoBalance * item.closingPrice - payedFees;
      totalBalance = eurBalance;
      cryptoBalance = 0;
    } else {
      /* case 3: state change, BUY SIGNAL */
      let payedFees = eurBalance * fees;
      eurBalance = eurBalance - payedFees;
      totalBalance = eurBalance;
      cryptoBalance = eurBalance / item.closingPrice;
      eurBalance = 0;
    }
    /* update portfolio State */
    isEur = newIsEur;
  }
  console.log(`totalBalance ${totalBalance}`);
}