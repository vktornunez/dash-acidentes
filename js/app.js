/* =============================================================================
   FRONTEND (DADOS VIA CSV LOCAL)
   Lógica do Dashboard carregando acidentes2025.csv
   ============================================================================= */

let map = null;
let chartEvolucao = null;
let chartTipos = null;
let chartCausas = null;
let chartRodovias = null;

let currentPage = 0;
const pageSize = 10;

// Variáveis para armazenar os dados em memória
let allRecords = [];       // Todos os registros (preserva múltiplas pessoas por ID)
let acidentesUnicos = [];  // Apenas 1 registro por ID (para evitar contagem dupla de acidentes)
let filteredData = [];     // Dados usados na tabela

// Dicionário de Coordenadas dos Estados (Centróides)
const ufCentroids = {
    'AC': [-9.02, -70.81], 'AL': [-9.57, -36.78], 'AM': [-3.41, -65.85],
    'AP': [1.41, -51.77], 'BA': [-12.57, -41.70], 'CE': [-5.49, -39.32],
    'DF': [-15.79, -47.89], 'ES': [-19.18, -40.30], 'GO': [-15.82, -49.83],
    'MA': [-4.96, -45.27], 'MG': [-18.51, -44.55], 'MS': [-20.77, -54.78],
    'MT': [-12.68, -56.92], 'PA': [-3.20, -52.00], 'PB': [-7.23, -36.78],
    'PE': [-8.81, -36.95], 'PI': [-7.71, -42.72], 'PR': [-25.25, -52.02],
    'RJ': [-22.90, -43.20], 'RN': [-5.40, -36.95], 'RO': [-11.56, -63.58],
    'RR': [2.73, -62.07], 'RS': [-30.03, -51.21], 'SC': [-27.24, -50.21],
    'SE': [-10.52, -37.38], 'SP': [-23.55, -46.63], 'TO': [-10.17, -48.29]
};

// ============================================================================
// 1. INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadCSVData();
    setupEventListeners();
});

function initMap() {
    map = L.map('map').setView([-14.2350, -51.9253], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
}

// ============================================================================
// 2. LEITURA E PROCESSAMENTO DO ARQUIVO CSV
// ============================================================================

function loadCSVData() {
    const statusText = document.getElementById('api-status-text');
    statusText.textContent = 'Dashboard Local (Dados via JS)';
    statusText.style.color = '#2a9d8f';
    
    // A variável csvData vem direto do arquivo dados.js
    parseCSV(csvData); 
    updateDashboard();
}
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    // Verifica se o delimitador é ponto e vírgula (padrão PRF) ou vírgula
    const delimiter = lines[0].includes(';') ? ';' : ','; 
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, '').toLowerCase());
    
    allRecords = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter);
        if (values.length === headers.length) {
            let row = {};
            headers.forEach((h, index) => {
                row[h] = values[index] ? values[index].trim().replace(/"/g, '') : '';
            });
            allRecords.push(row);
        }
    }

    // LIMPEZA DE DADOS (DUPLICATAS POR ID)
    // Extrai apenas um registro por ID para evitar contagem dupla de acidentes nos gráficos,
    // já que o mesmo ID possui várias linhas (múltiplas pessoas registradas).
    const mapUnicos = new Map();
    allRecords.forEach(row => {
        if (row.id && !mapUnicos.has(row.id)) {
            mapUnicos.set(row.id, row);
        }
    });
    acidentesUnicos = Array.from(mapUnicos.values());
    filteredData = [...acidentesUnicos];
}

// ============================================================================
// 3. ATUALIZAÇÃO DA INTERFACE (PROCESSAMENTO NACIONAL)
// ============================================================================
function updateDashboard() {
    renderKPIs();
    renderChartTipos();
    renderChartCausas();
    renderRiscoEstado();
    renderChartRodovias();
    renderTable();
}

function renderKPIs() {
    let kpi = { acidentes: acidentesUnicos.length, mortos: 0, feridos: 0, graves: 0, leves: 0, icrTotal: 0 };

    acidentesUnicos.forEach(a => {
        const mortos = parseInt(a.mortos) || 0;
        const graves = parseInt(a.feridos_graves) || 0;
        const leves = parseInt(a.feridos_leves) || 0;
        
        kpi.mortos += mortos;
        kpi.graves += graves;
        kpi.leves += leves;
        kpi.feridos += (graves + leves);
        
        // Pesos do Índice Comparativo de Risco (ICR): 1 leve, 5 grave, 15 morto
        kpi.icrTotal += (mortos * 15) + (graves * 5) + (leves * 1);
    });

    const icrMedio = kpi.acidentes > 0 ? (kpi.icrTotal / kpi.acidentes) : 0;

    document.getElementById('kpi-total-acidentes').textContent = kpi.acidentes.toLocaleString('pt-BR');
    document.getElementById('kpi-total-mortos').textContent = kpi.mortos.toLocaleString('pt-BR');
    document.getElementById('kpi-total-feridos').textContent = kpi.feridos.toLocaleString('pt-BR');
    document.getElementById('kpi-icr-medio').textContent = icrMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('kpi-detalhe-feridos').textContent = `${kpi.graves.toLocaleString('pt-BR')} graves | ${kpi.leves.toLocaleString('pt-BR')} leves`;
}

// Funções utilitárias para agrupar e ordenar dados para os gráficos
function getTopItems(field, limit = 6) {
    const mapCount = {};
    acidentesUnicos.forEach(a => {
        const item = a[field] || 'Não Informado';
        mapCount[item] = (mapCount[item] || 0) + 1;
    });
    return Object.entries(mapCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
}

function renderChartTipos() {
    const topTipos = getTopItems('tipo_acidente', 6);
    const ctx = document.getElementById('chart-tipos').getContext('2d');
    if (chartTipos) chartTipos.destroy();

    chartTipos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: topTipos.map(t => t[0]),
            datasets: [{ data: topTipos.map(t => t[1]), backgroundColor: ['#3a86ef', '#00b4d8', '#ffb703', '#fb8500', '#e63946', '#8d99ae'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } } }
    });
}

function renderChartCausas() {
    const topCausas = getTopItems('causa_acidente', 5);
    const ctx = document.getElementById('chart-causas').getContext('2d');
    if (chartCausas) chartCausas.destroy();

    chartCausas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topCausas.map(c => c[0]),
            datasets: [{ label: 'Ocorrências', data: topCausas.map(c => c[1]), backgroundColor: '#ffb703' }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8', font: { size: 10 } } } } }
    });
}

function renderChartRodovias() {
    const brIcrMap = {};
    acidentesUnicos.forEach(a => {
        if (!a.br) return;
        const br = `BR-${a.br}`;
        const mortos = parseInt(a.mortos) || 0;
        const graves = parseInt(a.feridos_graves) || 0;
        const leves = parseInt(a.feridos_leves) || 0;
        const icr = (mortos * 15) + (graves * 5) + (leves * 1);
        brIcrMap[br] = (brIcrMap[br] || 0) + icr;
    });

    const topRodovias = Object.entries(brIcrMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const ctx = document.getElementById('chart-rodovias').getContext('2d');
    if (chartRodovias) chartRodovias.destroy();

    chartRodovias = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topRodovias.map(r => r[0]),
            datasets: [{ label: 'Índice Comparativo de Risco (ICR)', data: topRodovias.map(r => r[1]), backgroundColor: '#e63946' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
    });
}

function renderRiscoEstado() {
    const estadoIcrMap = {};
    
    // Agrupa dados por UF
    acidentesUnicos.forEach(a => {
        const uf = (a.uf || '').toUpperCase();
        if (!uf) return;
        
        if (!estadoIcrMap[uf]) {
            estadoIcrMap[uf] = { uf, total_acidentes: 0, total_mortos: 0, icr_total: 0 };
        }
        
        const mortos = parseInt(a.mortos) || 0;
        const graves = parseInt(a.feridos_graves) || 0;
        const leves = parseInt(a.feridos_leves) || 0;
        
        estadoIcrMap[uf].total_acidentes += 1;
        estadoIcrMap[uf].total_mortos += mortos;
        estadoIcrMap[uf].icr_total += (mortos * 15) + (graves * 5) + (leves * 1);
    });

    // Remove os círculos antigos antes de desenhar
    map.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    Object.values(estadoIcrMap).forEach(item => {
        const centroid = ufCentroids[item.uf];
        if (centroid) {
            const color = item.icr_total > 5000 ? '#e63946' : item.icr_total > 2000 ? '#ffb703' : '#00b4d8';
            
            // O raio varia de forma dinâmica com a quantidade de acidentes
            const radiusSize = Math.min(Math.max(item.total_acidentes / 50, 8), 35);

            const circle = L.circleMarker(centroid, {
                radius: radiusSize,
                fillColor: color, color: '#fff', weight: 1, opacity: 1, fillOpacity: 0.7
            }).addTo(map);

            circle.bindPopup(`
                <div style="color: #000;">
                    <strong>${item.uf} — PRF 2025</strong><br>
                    Acidentes: <b>${item.total_acidentes}</b><br>
                    Vítimas Fatais: <b>${item.total_mortos}</b><br>
                    Índice Risco (ICR): <b>${item.icr_total}</b>
                </div>
            `);
        }
    });
}

// ============================================================================
// 4. LÓGICA DE TABELA E PAGINAÇÃO LOCAL
// ============================================================================
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    const total = filteredData.length;
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Nenhuma ocorrência encontrada.</td></tr>';
        document.getElementById('pagination-info').textContent = `Exibindo 0 ocorrências`;
        document.getElementById('btn-prev-page').disabled = true;
        document.getElementById('btn-next-page').disabled = true;
        return;
    }

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        
        let classBadge = 'badge-sem-vitimas';
        const classAcidente = (row.classificacao_acidente || '').toLowerCase();
        if (classAcidente.includes('fatal') || classAcidente.includes('óbito')) classBadge = 'badge-fatal';
        else if (classAcidente.includes('ferid') || classAcidente.includes('grave')) classBadge = 'badge-feridos';

        tr.innerHTML = `
            <td><strong>#${row.id || '-'}</strong></td>
            <td>${row.data_inversa || '-'}</td>
            <td>${row.horario || '-'}</td>
            <td><span class="badge">${row.uf || '-'}</span></td>
            <td>BR-${row.br || '-'}</td>
            <td>${row.km || '-'}</td>
            <td>${row.municipio || '-'}</td>
            <td>${row.tipo_acidente || '-'}</td>
            <td>${row.causa_acidente || '-'}</td>
            <td><span class="${classBadge}">${row.classificacao_acidente || 'Sem Vítimas'}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('pagination-info').textContent = `Exibindo ${startIndex + 1}-${endIndex} de ${total} ocorrências`;
    document.getElementById('btn-prev-page').disabled = currentPage === 0;
    document.getElementById('btn-next-page').disabled = endIndex >= total;
}

// ============================================================================
// 5. EVENT LISTENERS DOS FILTROS E PESQUISA
// ============================================================================
function setupEventListeners() {
    document.getElementById('btn-refresh').addEventListener('click', updateDashboard);

    document.getElementById('btn-apply-filters').addEventListener('click', () => {
        const uf = document.getElementById('filter-uf').value.toLowerCase();
        const br = document.getElementById('filter-br').value;
        
        filteredData = acidentesUnicos.filter(d => {
            const matchUF = uf === '' || (d.uf || '').toLowerCase() === uf;
            const matchBR = br === '' || (d.br || '') === br;
            return matchUF && matchBR;
        });
        
        currentPage = 0;
        renderTable();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.getElementById('filter-uf').value = '';
        document.getElementById('filter-br').value = '';
        document.getElementById('table-search-input').value = '';
        
        filteredData = [...acidentesUnicos];
        currentPage = 0;
        renderTable();
    });

    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            renderTable();
        }
    });

    document.getElementById('btn-next-page').addEventListener('click', () => {
        const maxPage = Math.ceil(filteredData.length / pageSize) - 1;
        if (currentPage < maxPage) {
            currentPage++;
            renderTable();
        }
    });

    document.getElementById('table-search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filteredData = acidentesUnicos.filter(d => 
            (d.municipio || '').toLowerCase().includes(term) ||
            (d.causa_acidente || '').toLowerCase().includes(term) ||
            (d.uf || '').toLowerCase().includes(term)
        );
        currentPage = 0;
        renderTable();
    });
}