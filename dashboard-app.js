// --- Configuración de Canales Base (AS7341 + AS7263) ---
const SPECTRAL_BANDS = [
    { sensor: "AS7341", channel: "F1 (Violeta)", nm: 415 },
    { sensor: "AS7341", channel: "F2 (Índigo)", nm: 445 },
    { sensor: "AS7341", channel: "F3 (Azul)", nm: 480 },
    { sensor: "AS7341", channel: "F4 (Cian)", nm: 515 },
    { sensor: "AS7341", channel: "F5 (Verde)", nm: 555 },
    { sensor: "AS7341", channel: "F6 (Amarillo)", nm: 590 },
    { sensor: "AS7341", channel: "F7 (Naranja)", nm: 630 },
    { sensor: "AS7341", channel: "F8 (Rojo)", nm: 680 },
    { sensor: "AS7263", channel: "R (NIR 1)", nm: 610 },
    { sensor: "AS7263", channel: "S (NIR 2)", nm: 680 },
    { sensor: "AS7263", channel: "T (NIR 3)", nm: 730 },
    { sensor: "AS7263", channel: "U (NIR 4)", nm: 760 },
    { sensor: "AS7263", channel: "V (NIR 5)", nm: 810 },
    { sensor: "AS7263", channel: "W (NIR 6)", nm: 860 }
];

const STORAGE_KEY = "sias_spectral_samples_v1";
let samples = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let chartInstance = null;

// --- Inicialización ---
document.addEventListener("DOMContentLoaded", () => {
    initChart();
    refreshUI();

    document.getElementById("btnSimulate").addEventListener("click", generateSimulatedSample);
    document.getElementById("fileInput").addEventListener("change", handleFileUpload);
    document.getElementById("btnExportJson").addEventListener("click", exportJSON);
    document.getElementById("btnExportCsv").addEventListener("click", exportCSV);
    document.getElementById("sampleSelector").addEventListener("change", updateViewFromSelection);
    document.getElementById("compareCheck").addEventListener("change", updateViewFromSelection);
    document.getElementById("btnClearAll").addEventListener("click", clearSamples);
    document.getElementById("btnConnectSerial").addEventListener("click", connectESP32Serial);
    document.getElementById("btnConnectBle").addEventListener("click", connectESP32Ble);
});

function initChart() {
    const ctx = document.getElementById("spectralChart").getContext("2d");
    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: SPECTRAL_BANDS.map(b => `${b.nm} nm`),
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "bottom" }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Intensidad de señal (cuentas)" }
                },
                x: {
                    title: { display: true, text: "Longitud de onda (nm)" }
                }
            }
        }
    });
}

function saveSamples() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples.slice(0, 300)));
    refreshUI();
}

function refreshUI() {
    document.getElementById("sampleCount").textContent = samples.length;
    const selector = document.getElementById("sampleSelector");
    selector.innerHTML = "";

    if (samples.length === 0) {
        selector.innerHTML = `<option value="">Sin mediciones cargadas</option>`;
        chartInstance.data.datasets = [];
        chartInstance.update();
        renderTable(null);
        return;
    }

    samples.forEach((s, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `${s.id} · ${s.source} (${new Date(s.timestamp).toLocaleTimeString()})`;
        selector.appendChild(opt);
    });

    selector.value = "0";
    updateViewFromSelection();
}

function updateViewFromSelection() {
    const idx = parseInt(document.getElementById("sampleSelector").value, 10);
    if (isNaN(idx) || !samples[idx]) return;

    const current = samples[idx];
    const compare = document.getElementById("compareCheck").checked;
    const datasets = [{
        label: `${current.id} (${current.source})`,
        data: current.values,
        borderColor: "#0f766e",
        backgroundColor: "rgba(15, 118, 110, 0.12)",
        borderWidth: 2.5,
        tension: 0.3,
        fill: true
    }];

    if (compare && samples[idx + 1]) {
        const prev = samples[idx + 1];
        datasets.push({
            label: `${prev.id} (Anterior)`,
            data: prev.values,
            borderColor: "#d97706",
            backgroundColor: "transparent",
            borderDash: [5, 5],
            borderWidth: 2,
            tension: 0.3
        });
    }

    chartInstance.data.datasets = datasets;
    chartInstance.update();
    renderTable(current);
}

function renderTable(sample) {
    const tbody = document.getElementById("channelsTableBody");
    if (!sample) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:1.5rem; text-align:center; color:var(--text-muted);">Sube un archivo JSON/CSV, conecta el prototipo o genera una muestra simulada para ver los datos.</td></tr>`;
        return;
    }

    tbody.innerHTML = SPECTRAL_BANDS.map((band, i) => `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
            <td style="padding:0.65rem 0.75rem; font-weight:600;">${band.sensor}</td>
            <td style="padding:0.65rem 0.75rem;">${band.channel}</td>
            <td style="padding:0.65rem 0.75rem;">${band.nm} nm</td>
            <td style="padding:0.65rem 0.75rem; font-family:monospace; font-weight:700; color:var(--forest-dark);">${sample.values[i] ?? 0}</td>
        </tr>
    `).join("");
}

// --- Generar Muestra Simulada ---
function generateSimulatedSample() {
    const values = SPECTRAL_BANDS.map((b, i) => {
        const base = 120 + Math.sin(i * 0.45) * 90 + Math.random() * 85;
        return Math.round(Math.max(15, base));
    });

    samples.unshift({
        id: `Muestra-${samples.length + 1}`,
        source: "Simulación Demo",
        timestamp: new Date().toISOString(),
        values
    });
    saveSamples();
}

// --- Subir Archivo JSON o CSV ---
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        try {
            if (file.name.endsWith(".json")) {
                const parsed = JSON.parse(content);
                const list = Array.isArray(parsed) ? parsed : [parsed];
                list.forEach((item, index) => {
                    if (Array.isArray(item.values)) {
                        samples.unshift({
                            id: item.id || `${file.name.replace(".json", "")}-${index + 1}`,
                            source: "Archivo JSON",
                            timestamp: item.timestamp || new Date().toISOString(),
                            values: item.values.slice(0, 14).map(Number)
                        });
                    }
                });
            } else if (file.name.endsWith(".csv")) {
                const lines = content.trim().split(/\r?\n/);
                lines.forEach((line, index) => {
                    if (index === 0 && isNaN(Number(line.split(",")[0]))) return;
                    const nums = line.split(",").map(Number).filter(n => !isNaN(n));
                    if (nums.length >= 14) {
                        samples.unshift({
                            id: `${file.name.replace(".csv", "")}-${index}`,
                            source: "Archivo CSV",
                            timestamp: new Date().toISOString(),
                            values: nums.slice(0, 14)
                        });
                    }
                });
            }
            saveSamples();
            document.getElementById("hwLog").textContent = `Archivo "${file.name}" cargado correctamente.`;
        } catch (err) {
            alert("No se pudo leer el archivo. Asegúrate de que contenga un arreglo 'values' con 14 datos numéricos (JSON) o 14 columnas numéricas (CSV).");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

// --- Exportar JSON / CSV ---
function exportJSON() {
    if (samples.length === 0) return alert("No hay muestras para exportar.");
    downloadFile(JSON.stringify(samples, null, 2), "lecturas_espectrales_sias.json", "application/json");
}

function exportCSV() {
    if (samples.length === 0) return alert("No hay muestras para exportar.");
    const headers = ["ID", "Origen", "Fecha", ...SPECTRAL_BANDS.map(b => `${b.sensor}_${b.nm}nm`)];
    const rows = samples.map(s => [s.id, s.source, s.timestamp, ...s.values].join(","));
    downloadFile([headers.join(","), ...rows].join("\n"), "lecturas_espectrales_sias.csv", "text/csv");
}

function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function clearSamples() {
    if (confirm("¿Seguro que deseas borrar todas las muestras guardadas en este navegador?")) {
        samples = [];
        saveSamples();
    }
}

// --- Conexión Real con ESP32 por USB (Web Serial API) ---
async function connectESP32Serial() {
    const log = document.getElementById("hwLog");
    const pill = document.getElementById("hwConnectionPill");

    if (!("serial" in navigator)) {
        log.textContent = "Tu navegador no soporta Web Serial. Usa Google Chrome o Microsoft Edge en escritorio.";
        return;
    }

    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        pill.textContent = "ESP32 Conectada (USB)";
        pill.className = "pill pill-green";
        log.textContent = "Puerto abierto a 115200 baudios. Esperando JSON desde la ESP32...";

        const decoder = new TextDecoderStream();
        port.readable.pipeTo(decoder.writable);
        const reader = decoder.readable.getReader();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                try {
                    const data = JSON.parse(line.trim());
                    if (Array.isArray(data.values)) {
                        samples.unshift({
                            id: `ESP32-${samples.length + 1}`,
                            source: "Hardware ESP32",
                            timestamp: new Date().toISOString(),
                            values: data.values.slice(0, 14).map(Number)
                        });
                        saveSamples();
                        log.textContent = `Lectura recibida de ESP32 (${new Date().toLocaleTimeString()})`;
                    }
                } catch (_) { /* Ignorar líneas parciales de debug */ }
            }
        }
    } catch (err) {
        log.textContent = "Conexión serial cancelada o interrumpida.";
    }
}

// --- Conexión Bluetooth (Web Bluetooth API) ---
async function connectESP32Ble() {
    const log = document.getElementById("hwLog");
    if (!("bluetooth" in navigator)) {
        log.textContent = "Web Bluetooth no disponible en este navegador.";
        return;
    }
    try {
        log.textContent = "Buscando dispositivos BLE cercanos (ESP32_SIAS)...";
        const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
        document.getElementById("hwConnectionPill").textContent = `BLE: ${device.name || "ESP32"}`;
        document.getElementById("hwConnectionPill").className = "pill pill-green";
        log.textContent = `Dispositivo seleccionado: ${device.name || "Nodo sin nombre"}. Listo para suscribir característica GATT.`;
    } catch (err) {
        log.textContent = "Búsqueda Bluetooth cancelada.";
    }
}
