    // Your JavaScript code remains exactly the same
    let chart;
    const presetData = {
      sales: {
        headers: ["Month", "Sales"],
        data: [
          ["January", 12000],
          ["February", 15000],
          ["March", 18000],
          ["April", 14000],
          ["May", 21000],
          ["June", 19000]
        ]
      },
      expenses: {
        headers: ["Category", "Amount"],
        data: [
          ["Housing", 1200],
          ["Food", 500],
          ["Transportation", 300],
          ["Entertainment", 200],
          ["Utilities", 150],
          ["Healthcare", 100]
        ]
      },
      population: {
        headers: ["Country", "Population (millions)"],
        data: [
          ["China", 1412],
          ["India", 1380],
          ["USA", 331],
          ["Indonesia", 273],
          ["Pakistan", 225],
          ["Brazil", 213]
        ]
      },
      website: {
        headers: ["Page", "Visits"],
        data: [
          ["Home", 15000],
          ["About", 8000],
          ["Products", 12000],
          ["Contact", 3000],
          ["Blog", 6000]
        ]
      },
      product: {
        headers: ["Product", "Rating"],
        data: [
          ["Product A", 4.5],
          ["Product B", 3.8],
          ["Product C", 4.2],
          ["Product D", 4.7],
          ["Product E", 3.9]
        ]
      }
    };

    function addRow() {
      const table = document.getElementById("sheet");
      const cols = table.rows[0].cells.length;
      const row = table.insertRow();
      for (let i = 0; i < cols; i++) {
        const cell = row.insertCell();
        cell.innerHTML = '<input class="form-control" style="background: transparent; border: none;">';
      }
    }

    function removeRow() {
      const table = document.getElementById("sheet");
      if (table.rows.length > 2) {
        table.deleteRow(table.rows.length - 1);
      } else {
        alert("Need at least one data row.");
      }
    }

    function loadPreset() {
      const preset = document.getElementById("presets").value;
      if (!preset) return;
      
      const data = presetData[preset];
      const table = document.getElementById("sheet");
      
      // Clear existing rows
      while (table.rows.length > 1) {
        table.deleteRow(1);
      }
      
      // Update headers
      for (let i = 0; i < data.headers.length; i++) {
        if (i < table.rows[0].cells.length) {
          table.rows[0].cells[i].innerText = data.headers[i];
        } else {
          const cell = table.rows[0].insertCell();
          cell.outerHTML = `<th>${data.headers[i]}</th>`;
        }
      }
      
      // Add data rows
      data.data.forEach(rowData => {
        const row = table.insertRow();
        rowData.forEach(cellData => {
          const cell = row.insertCell();
          cell.innerHTML = `<input class="form-control" value="${cellData}" style="background: transparent; border: none;">`;
        });
      });
      
      // Remove extra columns if needed
      while (table.rows[0].cells.length > data.headers.length) {
        for (let i = 0; i < table.rows.length; i++) {
          table.rows[i].deleteCell(table.rows[i].cells.length - 1);
        }
      }
    }

    function downloadSpreadsheet() {
      const table = document.getElementById("sheet");
      const data = [];
      
      // Get headers
      const headers = [];
      for (let i = 0; i < table.rows[0].cells.length; i++) {
        headers.push(table.rows[0].cells[i].innerText);
      }
      data.push(headers);
      
      // Get data rows
      for (let r = 1; r < table.rows.length; r++) {
        const rowData = [];
        for (let c = 0; c < table.rows[r].cells.length; c++) {
          const inp = table.rows[r].cells[c].querySelector("input");
          rowData.push(inp ? inp.value : table.rows[r].cells[c].innerText);
        }
        data.push(rowData);
      }
      
      // Create worksheet and workbook
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      
      // Download the file
      XLSX.writeFile(wb, "leprVisuals_Data.xlsx");
    }

    function handleFileUpload(files) {
      if (!files.length) return;
      
      const file = files[0];
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        
        // Get first worksheet
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert to JSON (limit to first 365 rows)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1});
        
        // Update the table
        const table = document.getElementById("sheet");
        
        // Clear existing rows
        while (table.rows.length > 0) {
          table.deleteRow(0);
        }
        
        // Add new rows (limit to 365)
        const maxRows = Math.min(jsonData.length, 366); // 1 header + 365 data rows
        
        for (let r = 0; r < maxRows; r++) {
          const row = table.insertRow();
          // Only use first two columns
          const maxCols = Math.min(jsonData[r].length, 2);
          
          for (let c = 0; c < maxCols; c++) {
            const cell = row.insertCell();
            if (r === 0) {
              cell.outerHTML = `<th>${jsonData[r][c] || `Column ${c+1}`}</th>`;
            } else {
              cell.innerHTML = `<input class="form-control" value="${jsonData[r][c] || ''}" style="background: transparent; border: none;">`;
            }
          }
        }
      };
      
      reader.readAsArrayBuffer(file);
    }

    function toggleCustomSize() {
      const sizeType = document.getElementById("chartSize").value;
      const customInputs = document.getElementById("customSizeInputs");
      
      if (sizeType === "custom") {
        customInputs.style.display = "flex";
      } else {
        customInputs.style.display = "none";
      }
    }

    function generateChartFromSheet() {
      const table = document.getElementById("sheet");
      const rows = [];
      
      for (let r = 0; r < table.rows.length; r++) {
        const cells = [];
        for (let c = 0; c < table.rows[r].cells.length; c++) {
          const inp = table.rows[r].cells[c].querySelector("input");
          cells.push(inp ? inp.value : table.rows[r].cells[c].innerText);
        }
        rows.push(cells);
      }

      if (rows.length < 2) {
        alert("Need at least 1 data row.");
        return;
      }

      const labels = rows.slice(1).map(r => r[0]);
      const values = rows.slice(1).map(r => Number(r[1]));

      const ctx = document.getElementById("chartCanvas").getContext("2d");
      const chartType = document.getElementById("chartType").value;
      
      // Handle chart size
      const sizeType = document.getElementById("chartSize").value;
      const chartWrapper = document.getElementById("chartWrapper");
      
      if (sizeType === "window") {
        chartWrapper.style.width = "90%";
        chartWrapper.style.height = "90vh";
        chartWrapper.style.maxHeight = "90%";
      } else if (sizeType === "square") {
        const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9);
        chartWrapper.style.width = `${size}px`;
        chartWrapper.style.height = `${size}px`;
        chartWrapper.style.maxHeight = "none";
      } else if (sizeType === "custom") {
        const width = document.getElementById("customWidth").value || 800;
        const height = document.getElementById("customHeight").value || 600;
        chartWrapper.style.width = `${width}px`;
        chartWrapper.style.height = `${height}px`;
        chartWrapper.style.maxHeight = "none";
      }

      if (chart) chart.destroy();
      
      // Prepare chart data based on type
      let chartData;
      if (chartType === "bubble") {
        // For bubble charts, we need x, y, and r values
        chartData = {
          datasets: [{
            label: rows[0][1] || "Values",
            data: values.map((v, i) => ({
              x: i,
              y: v,
              r: Math.min(Math.max(v / Math.max(...values) * 20, 5), 30)
            })),
            backgroundColor: "#ffd600",
            borderColor: "#000",
            borderWidth: 1
          }]
        };
      } else if (chartType === "scatter") {
        // For scatter plots, we need x and y values
        chartData = {
          datasets: [{
            label: rows[0][1] || "Values",
            data: values.map((v, i) => ({
              x: i,
              y: v
            })),
            backgroundColor: "#ffd600",
            borderColor: "#000",
            borderWidth: 1
          }]
        };
      } else {
        // For other chart types
        chartData = {
          labels,
          datasets: [{
            label: rows[0][1] || "Values",
            data: values,
            backgroundColor: [
              "#ffd600", "#2de2a6", "#ff3864", "#f5f5f5", "#ffed4e", "#00bcd4", "#8e44ad"
            ],
            borderColor: "#0b0b12",
            borderWidth: 1
          }]
        };
      }

      chart = new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: "bottom", 
              labels: { 
                color: "#0b0b12",
                font: {
                  size: 14
                }
              } 
            },
            title: {
              display: true,
              text: 'leprVisuals Chart',
              color: "#0b0b12",
              font: {
                size: 18
              }
            }
          },
          scales: (chartType !== "pie" && chartType !== "doughnut" && chartType !== "polarArea") ? {
            x: { 
              ticks: { color: "#0b0b12" },
              grid: {
                color: "rgba(0,0,0,0.1)"
              }
            },
            y: { 
              ticks: { color: "#0b0b12" },
              grid: {
                color: "rgba(0,0,0,0.1)"
              }
            }
          } : {}
        }
      });
      
      // Scroll to chart
      document.getElementById("chartWrapper").scrollIntoView({ 
        behavior: 'smooth' 
      });
    }

    function showScreenshotOptions() {
      if (!chart) {
        alert("Generate a chart first!");
        return;
      }
      document.getElementById("screenshotModal").style.display = "flex";
    }

    function takeScreenshot() {
      const canvas = document.getElementById("chartCanvas");
      const bgType = document.querySelector('input[name="bgType"]:checked').value;
      const margin = parseInt(document.getElementById("marginSize").value) || 0;
      
      // Create a temporary canvas with margin
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCanvas.width = canvas.width + margin * 2;
      tempCanvas.height = canvas.height + margin * 2;
      
      // Fill background
      if (bgType === 'white') {
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      } else {
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      }
      
      // Draw the chart with margin
      tempCtx.drawImage(canvas, margin, margin);
      
      // Download the image
      const link = document.createElement("a");
      link.href = tempCanvas.toDataURL("image/png");
      link.download = `leprVisuals_chart_${new Date().getTime()}.png`;
      link.click();
      
      // Close the modal
      document.getElementById("screenshotModal").style.display = "none";
    }