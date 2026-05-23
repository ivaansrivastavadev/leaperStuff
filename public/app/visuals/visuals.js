/* ══════════════════════════════════════════════════════════
   leprVisuals — visuals.js
   Updated for Wafflent DS table structure (thead/tbody split)
   Chart colors updated to Wafflent accent palette
   ══════════════════════════════════════════════════════════ */

let chart;

/* ─── Wafflent accent palette for charts ─── */
const CHART_COLORS = [
  '#F5A623', '#4CAF50', '#2196F3', '#FF9800',
  '#E91E63', '#9C27B0', '#00BCD4', '#FF5722',
  '#8BC34A', '#FFC107', '#3F51B5', '#009688'
];

const presetData = {
  sales: {
    headers: ['Month', 'Sales'],
    data: [
      ['January',12000],['February',15000],['March',18000],
      ['April',14000],['May',21000],['June',19000]
    ]
  },
  expenses: {
    headers: ['Category', 'Amount'],
    data: [
      ['Housing',1200],['Food',500],['Transportation',300],
      ['Entertainment',200],['Utilities',150],['Healthcare',100]
    ]
  },
  population: {
    headers: ['Country', 'Population (M)'],
    data: [
      ['China',1412],['India',1380],['USA',331],
      ['Indonesia',273],['Pakistan',225],['Brazil',213]
    ]
  },
  website: {
    headers: ['Page', 'Visits'],
    data: [
      ['Home',15000],['About',8000],['Products',12000],
      ['Contact',3000],['Blog',6000]
    ]
  },
  product: {
    headers: ['Product', 'Rating'],
    data: [
      ['Product A',4.5],['Product B',3.8],['Product C',4.2],
      ['Product D',4.7],['Product E',3.9]
    ]
  }
};

/* ─── Helpers ─── */
function getSheet() { return document.getElementById('sheet'); }
function getTbody()  { return getSheet().querySelector('tbody'); }
function getThead()  { return getSheet().querySelector('thead'); }

function makeInput(value = '') {
  const input = document.createElement('input');
  input.value = value;
  return input;
}

/* ─── Add / Remove rows ─── */
function addRow() {
  const tbody = getTbody();
  const colCount = getThead().rows[0].cells.length;
  const row = tbody.insertRow();
  for (let i = 0; i < colCount; i++) {
    const td = row.insertCell();
    td.appendChild(makeInput(''));
  }
}

function removeRow() {
  const tbody = getTbody();
  if (tbody.rows.length > 1) {
    tbody.deleteRow(tbody.rows.length - 1);
  } else {
    alert('Need at least one data row.');
  }
}

/* ─── Load preset ─── */
function loadPreset() {
  const key = document.getElementById('presets').value;
  if (!key) return;
  const preset = presetData[key];

  const thead = getThead();
  const tbody = getTbody();

  // Update header cells
  const headerRow = thead.rows[0];
  // Remove extra header cells
  while (headerRow.cells.length > preset.headers.length) {
    headerRow.deleteCell(headerRow.cells.length - 1);
  }
  // Set / add header cells
  preset.headers.forEach((h, i) => {
    if (i < headerRow.cells.length) {
      headerRow.cells[i].textContent = h;
    } else {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    }
  });

  // Clear and repopulate body
  tbody.innerHTML = '';
  preset.data.forEach(rowData => {
    const row = tbody.insertRow();
    rowData.forEach(val => {
      const td = row.insertCell();
      td.appendChild(makeInput(String(val)));
    });
  });

  document.getElementById('presets').value = '';
}

/* ─── Download XLSX ─── */
function downloadSpreadsheet() {
  const thead = getThead();
  const tbody = getTbody();
  const out = [];

  // Headers
  const headers = Array.from(thead.rows[0].cells).map(c => c.textContent.trim());
  out.push(headers);

  // Data rows
  Array.from(tbody.rows).forEach(row => {
    const cells = Array.from(row.cells).map(td => {
      const inp = td.querySelector('input');
      return inp ? inp.value : td.textContent;
    });
    out.push(cells);
  });

  const ws = XLSX.utils.aoa_to_sheet(out);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, 'leprVisuals_Data.xlsx');
}

/* ─── Upload XLSX ─── */
function handleFileUpload(files) {
  if (!files.length) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data     = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const ws       = workbook.Sheets[workbook.SheetNames[0]];
    const json     = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const thead = getThead();
    const tbody = getTbody();
    const maxRows = Math.min(json.length, 366);

    if (maxRows === 0) return;

    // Set headers from row 0 (max 2 cols)
    const headerRow = thead.rows[0];
    while (headerRow.firstChild) headerRow.removeChild(headerRow.firstChild);
    const numCols = Math.min((json[0] || []).length, 2);
    for (let c = 0; c < numCols; c++) {
      const th = document.createElement('th');
      th.textContent = json[0][c] != null ? String(json[0][c]) : `Column ${c + 1}`;
      headerRow.appendChild(th);
    }

    // Populate body rows
    tbody.innerHTML = '';
    for (let r = 1; r < maxRows; r++) {
      const row = tbody.insertRow();
      for (let c = 0; c < numCols; c++) {
        const td = row.insertCell();
        td.appendChild(makeInput(json[r][c] != null ? String(json[r][c]) : ''));
      }
    }
  };
  reader.readAsArrayBuffer(files[0]);
}

/* ─── Toggle custom size ─── */
function toggleCustomSize() {
  const val = document.getElementById('chartSize').value;
  document.getElementById('customSizeInputs').style.display = val === 'custom' ? 'flex' : 'none';
}

/* ─── Generate chart ─── */
function generateChartFromSheet() {
  const thead = getThead();
  const tbody = getTbody();

  if (tbody.rows.length < 1) { alert('Need at least 1 data row.'); return; }

  const headerLabel = thead.rows[0].cells[1]
    ? thead.rows[0].cells[1].textContent.trim()
    : 'Values';

  const labels = [];
  const values = [];
  Array.from(tbody.rows).forEach(row => {
    const inputs = row.querySelectorAll('input');
    labels.push(inputs[0] ? inputs[0].value : '');
    values.push(inputs[1] ? Number(inputs[1].value) : 0);
  });

  // Chart wrapper sizing
  const chartWrapper = document.getElementById('chartWrapper');
  const sizeType     = document.getElementById('chartSize').value;

  if (sizeType === 'window') {
    chartWrapper.style.width  = '100%';
    chartWrapper.style.height = '70vh';
  } else if (sizeType === 'square') {
    const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9);
    chartWrapper.style.width  = `${size}px`;
    chartWrapper.style.height = `${size}px`;
  } else {
    chartWrapper.style.width  = `${document.getElementById('customWidth').value  || 800}px`;
    chartWrapper.style.height = `${document.getElementById('customHeight').value || 600}px`;
  }

  chartWrapper.classList.add('visible');

  const ctx       = document.getElementById('chartCanvas').getContext('2d');
  const chartType = document.getElementById('chartType').value;

  if (chart) chart.destroy();

  /* Build dataset */
  let chartData;
  if (chartType === 'bubble') {
    chartData = {
      datasets: [{
        label: headerLabel,
        data: values.map((v, i) => ({
          x: i, y: v,
          r: Math.min(Math.max(v / Math.max(...values) * 20, 5), 30)
        })),
        backgroundColor: CHART_COLORS[0],
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth: 1
      }]
    };
  } else if (chartType === 'scatter') {
    chartData = {
      datasets: [{
        label: headerLabel,
        data: values.map((v, i) => ({ x: i, y: v })),
        backgroundColor: CHART_COLORS[0],
        borderColor: 'rgba(0,0,0,0.2)',
        borderWidth: 1
      }]
    };
  } else {
    chartData = {
      labels,
      datasets: [{
        label: headerLabel,
        data: values,
        backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: 'rgba(0,0,0,0.15)',
        borderWidth: 1,
        tension: 0.4  // smooth lines
      }]
    };
  }

  const isDark = true; // always dark in Wafflent
  const textColor  = '#F0EDE6';
  const gridColor  = 'rgba(240,237,230,0.08)';

  chart = new Chart(ctx, {
    type: chartType,
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 13, family: "'Inter', sans-serif" },
            padding: 20,
            usePointStyle: true
          }
        },
        title: {
          display: true,
          text: 'leprVisuals Chart',
          color: textColor,
          font: { size: 17, weight: '700', family: "'Inter', sans-serif" },
          padding: { bottom: 20 }
        },
        tooltip: {
          backgroundColor: '#2C2920',
          borderColor: 'rgba(245,166,35,0.3)',
          borderWidth: 1,
          titleColor: '#F5A623',
          bodyColor: '#A09A8E',
          padding: 12,
          cornerRadius: 10
        }
      },
      scales: (['pie','doughnut','polarArea','radar'].includes(chartType)) ? {} : {
        x: {
          ticks: { color: textColor, font: { family: "'Inter', sans-serif" } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { family: "'Inter', sans-serif" } },
          grid: { color: gridColor }
        }
      }
    }
  });

  chartWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ─── Screenshot modal ─── */
function showScreenshotOptions() {
  if (!chart) { alert('Generate a chart first!'); return; }
  document.getElementById('screenshotModal').classList.add('open');
}

function takeScreenshot() {
  const canvas = document.getElementById('chartCanvas');
  const bgType = document.querySelector('input[name="bgType"]:checked').value;
  const margin = parseInt(document.getElementById('marginSize').value) || 0;

  const tmp = document.createElement('canvas');
  tmp.width  = canvas.width  + margin * 2;
  tmp.height = canvas.height + margin * 2;
  const ctx  = tmp.getContext('2d');

  if (bgType === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
  }

  ctx.drawImage(canvas, margin, margin);

  const link = document.createElement('a');
  link.href     = tmp.toDataURL('image/png');
  link.download = `leprVisuals_${Date.now()}.png`;
  link.click();

  document.getElementById('screenshotModal').classList.remove('open');
}