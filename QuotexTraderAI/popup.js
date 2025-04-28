// Popup script for Quotex AI Trading Signals extension

// State
let state = {
  isActive: false,
  selectedTimeframe: 'M1',
  currentSignal: null,
  signalHistory: [],
  accuracyStats: {
    totalSignals: 0,
    correctSignals: 0
  }
};

// DOM elements
const activateToggle = document.getElementById('activate-toggle');
const timeframeButtons = document.querySelectorAll('.timeframe-btn');
const signalIcon = document.querySelector('.signal-icon');
const signalText = document.querySelector('.signal-text');
const strengthFill = document.getElementById('strength-fill');
const strengthValue = document.getElementById('strength-value');
const timestampElement = document.getElementById('timestamp');
const accuracyValue = document.getElementById('accuracy-value');
const totalSignalsElement = document.getElementById('total-signals');
const aiConfidenceElement = document.getElementById('ai-confidence');

// Technical indicator elements
const emaValue = document.getElementById('ema-value');
const macdValue = document.getElementById('macd-value');
const rsiValue = document.getElementById('rsi-value');
const bbValue = document.getElementById('bb-value');
const volumeValue = document.getElementById('volume-value');

// Chart
let signalsChart;

// Initialize popup
function initialize() {
  console.log('Initializing popup');
  
  // Get initial state from background script
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response && response.success) {
      state = {
        ...state,
        isActive: response.state.isActive,
        selectedTimeframe: response.state.selectedTimeframe,
        accuracyStats: response.state.accuracyStats
      };
      
      // Update UI based on state
      updateUI();
    }
  });
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize chart
  initializeChart();
}

// Set up event listeners
function setupEventListeners() {
  // Activate toggle
  activateToggle.addEventListener('change', (e) => {
    state.isActive = e.target.checked;
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'toggleActive',
      data: { isActive: state.isActive }
    });
    
    // Also send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleActive',
          data: { isActive: state.isActive }
        });
      }
    });
  });
  
  // Timeframe buttons
  timeframeButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      timeframeButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Update selected timeframe
      state.selectedTimeframe = button.dataset.timeframe;
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'setTimeframe',
        data: { timeframe: state.selectedTimeframe }
      });
      
      // Update UI to show loading state
      showLoadingState();
    });
  });
}

// Update UI based on current state
function updateUI() {
  // Update toggle
  activateToggle.checked = state.isActive;
  
  // Update timeframe buttons
  timeframeButtons.forEach(button => {
    if (button.dataset.timeframe === state.selectedTimeframe) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  
  // Update accuracy stats
  updateAccuracyStats();
  
  // Get current signal for selected timeframe
  chrome.runtime.sendMessage({
    action: 'getSignal',
    data: { timeframe: state.selectedTimeframe }
  }, (response) => {
    if (response && response.success && response.signal) {
      updateSignalDisplay(response.signal);
    } else {
      showNoSignalState();
    }
  });
}

// Show loading state while waiting for signal
function showLoadingState() {
  signalIcon.textContent = '⏳';
  signalIcon.className = 'signal-icon';
  signalText.textContent = 'Loading signal...';
  
  // Reset indicator values
  emaValue.textContent = '--';
  macdValue.textContent = '--';
  rsiValue.textContent = '--';
  bbValue.textContent = '--';
  volumeValue.textContent = '--';
  
  // Reset strength meter
  strengthFill.style.width = '0%';
  strengthFill.className = 'strength-fill';
  strengthValue.textContent = '0%';
  
  // Reset timestamp
  timestampElement.textContent = '--';
  
  // Reset AI confidence
  aiConfidenceElement.textContent = '--';
}

// Show state when no signal is available
function showNoSignalState() {
  signalIcon.textContent = '--';
  signalIcon.className = 'signal-icon';
  signalText.textContent = 'No signal available';
  
  // Reset indicator values
  emaValue.textContent = '--';
  macdValue.textContent = '--';
  rsiValue.textContent = '--';
  bbValue.textContent = '--';
  volumeValue.textContent = '--';
  
  // Reset strength meter
  strengthFill.style.width = '0%';
  strengthFill.className = 'strength-fill';
  strengthValue.textContent = '0%';
  
  // Reset timestamp
  timestampElement.textContent = '--';
  
  // Reset AI confidence
  aiConfidenceElement.textContent = '--';
}

// Update signal display with new signal data
function updateSignalDisplay(signal) {
  if (!signal) return;
  
  state.currentSignal = signal;
  
  // Update signal icon and text
  if (signal.type === 'buy') {
    signalIcon.textContent = '▲';
    signalIcon.className = 'signal-icon signal-buy';
    signalText.textContent = 'BUY Signal';
    signalText.className = 'signal-text signal-buy';
    
    strengthFill.className = 'strength-fill strength-fill-buy';
  } else if (signal.type === 'sell') {
    signalIcon.textContent = '▼';
    signalIcon.className = 'signal-icon signal-sell';
    signalText.textContent = 'SELL Signal';
    signalText.className = 'signal-text signal-sell';
    
    strengthFill.className = 'strength-fill strength-fill-sell';
  } else {
    signalIcon.textContent = '•';
    signalIcon.className = 'signal-icon signal-neutral';
    signalText.textContent = 'NEUTRAL Signal';
    signalText.className = 'signal-text signal-neutral';
    
    strengthFill.className = 'strength-fill strength-fill-neutral';
  }
  
  // Update strength meter
  strengthFill.style.width = `${signal.strength}%`;
  strengthValue.textContent = `${Math.round(signal.strength)}%`;
  
  // Update timestamp
  const signalTime = new Date(signal.timestamp);
  timestampElement.textContent = signalTime.toLocaleTimeString();
  
  // Update technical indicators
  if (signal.details) {
    emaValue.textContent = signal.details.ema || '--';
    macdValue.textContent = signal.details.macd || '--';
    rsiValue.textContent = typeof signal.details.rsi === 'number' ? signal.details.rsi.toFixed(2) : '--';
    bbValue.textContent = signal.details.bb || '--';
    volumeValue.textContent = signal.details.volume || '--';
  }
  
  // Update AI confidence
  aiConfidenceElement.textContent = `${Math.round(signal.aiConfidence * 100)}%`;
  
  // Add to signal history and update chart
  addSignalToHistory(signal);
  updateChart();
}

// Update accuracy statistics
function updateAccuracyStats() {
  const { totalSignals, correctSignals } = state.accuracyStats;
  
  totalSignalsElement.textContent = totalSignals;
  
  if (totalSignals > 0) {
    const accuracy = (correctSignals / totalSignals) * 100;
    accuracyValue.textContent = `${accuracy.toFixed(1)}%`;
  } else {
    accuracyValue.textContent = '--';
  }
}

// Add signal to history
function addSignalToHistory(signal) {
  // Keep only last 20 signals
  if (state.signalHistory.length >= 20) {
    state.signalHistory.shift();
  }
  
  state.signalHistory.push({
    timestamp: signal.timestamp,
    type: signal.type,
    strength: signal.strength
  });
}

// Initialize the signals chart
function initializeChart() {
  const ctx = document.getElementById('signals-chart').getContext('2d');
  
  signalsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Signal Strength',
          data: [],
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: function(context) {
            const index = context.dataIndex;
            const value = context.dataset.data[index];
            const signalType = state.signalHistory[index]?.type;
            
            if (signalType === 'buy') return '#4CAF50';
            if (signalType === 'sell') return '#F44336';
            return '#FFD700';
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          display: false
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: '#a0a0a0',
            font: {
              size: 10
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const signalType = state.signalHistory[index]?.type;
              const strength = context.parsed.y;
              
              return `${signalType.toUpperCase()}: ${strength}% strength`;
            },
            title: function(context) {
              const index = context[0].dataIndex;
              const timestamp = state.signalHistory[index]?.timestamp;
              
              if (timestamp) {
                return new Date(timestamp).toLocaleTimeString();
              }
              return '';
            }
          }
        }
      }
    }
  });
}

// Update chart with signal history data
function updateChart() {
  if (!signalsChart || !state.signalHistory.length) return;
  
  const labels = state.signalHistory.map(signal => {
    const date = new Date(signal.timestamp);
    return date.toLocaleTimeString();
  });
  
  const data = state.signalHistory.map(signal => signal.strength);
  
  signalsChart.data.labels = labels;
  signalsChart.data.datasets[0].data = data;
  
  signalsChart.update();
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'signalUpdated':
      if (request.data.timeframe === state.selectedTimeframe) {
        updateSignalDisplay(request.data.signal);
      }
      sendResponse({ success: true });
      break;
      
    case 'accuracyUpdated':
      state.accuracyStats = request.data.accuracyStats;
      updateAccuracyStats();
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Initialize when popup is loaded
document.addEventListener('DOMContentLoaded', initialize);
