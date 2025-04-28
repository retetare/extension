// Content script for Quotex AI Trading Signals extension
// Extracts candle data from Quotex platform and injects UI elements

// Configuration
const config = {
  extractionInterval: 5000, // 5 seconds
  observationInterval: 500, // 0.5 seconds
  selectors: {
    chart: '.chart-container', // Updated based on actual Quotex DOM
    candleContainer: '.candle-chart', // Updated based on actual Quotex DOM
    timeframeSelector: '.timeframe-selector', // Updated based on actual Quotex DOM
  }
};

// State
let state = {
  isActive: false,
  observingChart: false,
  currentTimeframe: 'M1',
  lastExtraction: null,
  signalOverlayAdded: false
};

// Initialize MutationObserver to detect when chart is loaded
const observer = new MutationObserver((mutations) => {
  if (!state.observingChart) {
    const chartElement = document.querySelector(config.selectors.chart);
    if (chartElement) {
      console.log('Chart detected, starting data extraction');
      state.observingChart = true;
      initializeExtraction();
      createSignalOverlay();
    }
  }
});

// Start observing document for chart element
function startObserving() {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Check for timeframe changes
  setInterval(checkTimeframe, config.observationInterval);
}

// Initialize data extraction
function initializeExtraction() {
  // Extract initial data
  extractCandleData();
  
  // Set up interval for continuous extraction
  setInterval(() => {
    if (state.isActive) {
      extractCandleData();
    }
  }, config.extractionInterval);
}

// Extract candle data from the chart
function extractCandleData() {
  try {
    // Make sure enough time has passed since last extraction
    const now = Date.now();
    if (state.lastExtraction && (now - state.lastExtraction) < config.extractionInterval) {
      return;
    }
    state.lastExtraction = now;
    
    // Access the chart data
    // This is a simplified version - in reality, we need to analyze the DOM
    // or intercept network requests to get the actual data
    
    // Method 1: Try to access chart data from window object
    let candleData = extractDataFromWindowObject();
    
    // Method 2: If data not found in window object, extract from DOM
    if (!candleData || !candleData.length) {
      candleData = extractDataFromDOM();
    }
    
    if (candleData && candleData.length) {
      console.log(`Extracted ${candleData.length} candles for ${state.currentTimeframe}`);
      
      // Send data to background script for processing
      chrome.runtime.sendMessage({
        action: 'newCandleData',
        data: {
          candleData: candleData,
          timeframe: state.currentTimeframe
        }
      }, (response) => {
        if (response && response.success) {
          updateSignalOverlay(response.signal);
        } else {
          console.error('Error processing candle data:', response?.error);
        }
      });
    } else {
      console.warn('No candle data extracted');
    }
  } catch (error) {
    console.error('Error extracting candle data:', error);
  }
}

// Attempt to extract data from the window object
function extractDataFromWindowObject() {
  try {
    // Most trading platforms store chart data in the window object
    // This is a simplified approach - we need to identify the actual variable name
    
    // Example: scan for potential objects containing price data
    for (const key in window) {
      try {
        const obj = window[key];
        if (typeof obj === 'object' && obj !== null) {
          // Look for objects that might contain OHLC data
          if (obj.prices || obj.candles || obj.chartData || obj.ohlc) {
            const dataObj = obj.prices || obj.candles || obj.chartData || obj.ohlc;
            
            if (Array.isArray(dataObj) && dataObj.length > 0) {
              const firstItem = dataObj[0];
              
              // Check if it has the expected shape of candle data
              if (firstItem && (firstItem.open !== undefined && firstItem.high !== undefined && 
                  firstItem.low !== undefined && firstItem.close !== undefined)) {
                    
                return dataObj.map(candle => {
                  return {
                    timestamp: candle.time || candle.timestamp || candle.date || Date.now(),
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume || 0
                  };
                });
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors when accessing window properties
        continue;
      }
    }
  } catch (error) {
    console.error('Error extracting data from window object:', error);
  }
  
  return null;
}

// Extract data from DOM elements (fallback method)
function extractDataFromDOM() {
  try {
    // Find candle elements in the DOM
    const candleElements = document.querySelectorAll(`${config.selectors.candleContainer} .candle, ${config.selectors.candleContainer} .bar`);
    
    if (!candleElements || candleElements.length === 0) {
      return null;
    }
    
    // Extract data from candle elements
    // This is approximate and would need to be adjusted for Quotex's actual DOM structure
    const candleData = [];
    
    candleElements.forEach((element, index) => {
      // Extract OHLC values from element attributes or computed style
      // These selectors would need to be adjusted for the actual Quotex DOM
      const height = parseFloat(element.getAttribute('height') || element.style.height);
      const top = parseFloat(element.getAttribute('y') || element.style.top);
      const width = parseFloat(element.getAttribute('width') || element.style.width);
      
      // Get price scale from axis labels
      const priceScale = estimatePriceScale();
      
      // Estimate OHLC values based on visual representation
      // This is very approximate and would need to be refined
      const close = priceScale.max - (top / priceScale.height) * (priceScale.max - priceScale.min);
      const open = priceScale.max - ((top + height) / priceScale.height) * (priceScale.max - priceScale.min);
      const high = Math.max(open, close) + (height * 0.1); // Estimate based on candle body
      const low = Math.min(open, close) - (height * 0.1);  // Estimate based on candle body
      
      candleData.push({
        timestamp: Date.now() - ((candleElements.length - index) * getTimeframeInMs(state.currentTimeframe)),
        open: open,
        high: high,
        low: low,
        close: close,
        volume: 0 // Volume data might not be extractable from DOM
      });
    });
    
    return candleData;
  } catch (error) {
    console.error('Error extracting data from DOM:', error);
    return null;
  }
}

// Estimate price scale from axis labels
function estimatePriceScale() {
  try {
    // Find price axis labels
    const yAxisLabels = document.querySelectorAll('.y-axis-label, .price-axis-label');
    
    if (!yAxisLabels || yAxisLabels.length < 2) {
      // Fallback to a default scale if labels are not found
      return { min: 0, max: 100, height: document.querySelector(config.selectors.chart).clientHeight };
    }
    
    // Extract min and max values from labels
    const values = Array.from(yAxisLabels).map(label => {
      return parseFloat(label.textContent.replace(/[^\d.-]/g, ''));
    }).filter(val => !isNaN(val));
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      min,
      max,
      height: document.querySelector(config.selectors.chart).clientHeight
    };
  } catch (error) {
    console.error('Error estimating price scale:', error);
    return { min: 0, max: 100, height: 300 };
  }
}

// Check and update the current timeframe
function checkTimeframe() {
  try {
    // Find the active timeframe selector
    const activeTimeframe = document.querySelector(`${config.selectors.timeframeSelector} .active, ${config.selectors.timeframeSelector} .selected`);
    
    if (activeTimeframe) {
      const timeframeText = activeTimeframe.textContent.trim();
      
      // Map Quotex timeframe text to our format
      let newTimeframe = state.currentTimeframe;
      
      if (timeframeText.includes('1m') || timeframeText.includes('1M')) {
        newTimeframe = 'M1';
      } else if (timeframeText.includes('5m') || timeframeText.includes('5M')) {
        newTimeframe = 'M5';
      } else if (timeframeText.includes('15m') || timeframeText.includes('15M')) {
        newTimeframe = 'M15';
      }
      
      // Update timeframe if changed
      if (newTimeframe !== state.currentTimeframe) {
        state.currentTimeframe = newTimeframe;
        console.log(`Timeframe changed to ${state.currentTimeframe}`);
        
        // Notify background script about timeframe change
        chrome.runtime.sendMessage({
          action: 'setTimeframe',
          data: { timeframe: state.currentTimeframe }
        });
        
        // Re-extract data for new timeframe
        extractCandleData();
      }
    }
  } catch (error) {
    console.error('Error checking timeframe:', error);
  }
}

// Convert timeframe to milliseconds
function getTimeframeInMs(timeframe) {
  switch (timeframe) {
    case 'M1': return 60 * 1000;
    case 'M5': return 5 * 60 * 1000;
    case 'M15': return 15 * 60 * 1000;
    default: return 60 * 1000;
  }
}

// Create signal overlay on the chart
function createSignalOverlay() {
  if (state.signalOverlayAdded) return;
  
  try {
    const chartContainer = document.querySelector(config.selectors.chart);
    
    if (!chartContainer) {
      console.warn('Chart container not found');
      return;
    }
    
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'quotex-ai-signal-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '10px';
    overlay.style.right = '10px';
    overlay.style.padding = '10px';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.borderRadius = '5px';
    overlay.style.color = 'white';
    overlay.style.zIndex = '1000';
    overlay.style.fontFamily = 'Arial, sans-serif';
    overlay.style.fontSize = '14px';
    overlay.style.width = '180px';
    
    // Create signal content
    overlay.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <div><strong>Quotex AI Signals</strong></div>
        <div id="signal-timeframe">${state.currentTimeframe}</div>
      </div>
      <div id="signal-indicator" style="text-align: center; font-size: 24px; margin: 10px 0;">--</div>
      <div id="signal-strength-container" style="height: 8px; background: #333; border-radius: 4px; margin: 10px 0;">
        <div id="signal-strength-bar" style="height: 100%; width: 0%; border-radius: 4px;"></div>
      </div>
      <div id="signal-recommendation" style="text-align: center; font-weight: bold;">Waiting for signal...</div>
      <div style="font-size: 12px; margin-top: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <div>EMA:</div>
          <div id="indicator-ema">--</div>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <div>MACD:</div>
          <div id="indicator-macd">--</div>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <div>RSI:</div>
          <div id="indicator-rsi">--</div>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <div>BB:</div>
          <div id="indicator-bb">--</div>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <div>Volume:</div>
          <div id="indicator-volume">--</div>
        </div>
      </div>
      <div style="font-size: 11px; text-align: center; margin-top: 10px; opacity: 0.7;">
        AI Confidence: <span id="ai-confidence">--</span>
      </div>
    `;
    
    // Add overlay to chart container
    chartContainer.appendChild(overlay);
    state.signalOverlayAdded = true;
    
    console.log('Signal overlay created');
  } catch (error) {
    console.error('Error creating signal overlay:', error);
  }
}

// Update signal overlay with new signal data
function updateSignalOverlay(signal) {
  if (!signal) return;
  
  try {
    // Update timeframe
    const timeframeElement = document.getElementById('signal-timeframe');
    if (timeframeElement) {
      timeframeElement.textContent = state.currentTimeframe;
    }
    
    // Update signal indicator
    const indicatorElement = document.getElementById('signal-indicator');
    if (indicatorElement) {
      if (signal.type === 'buy') {
        indicatorElement.textContent = '▲';
        indicatorElement.style.color = '#4CAF50';
      } else if (signal.type === 'sell') {
        indicatorElement.textContent = '▼';
        indicatorElement.style.color = '#F44336';
      } else {
        indicatorElement.textContent = '•';
        indicatorElement.style.color = '#FFD700';
      }
    }
    
    // Update signal strength bar
    const strengthBar = document.getElementById('signal-strength-bar');
    if (strengthBar) {
      strengthBar.style.width = `${signal.strength}%`;
      
      if (signal.type === 'buy') {
        strengthBar.style.background = '#4CAF50';
      } else if (signal.type === 'sell') {
        strengthBar.style.background = '#F44336';
      } else {
        strengthBar.style.background = '#FFD700';
      }
    }
    
    // Update recommendation
    const recommendationElement = document.getElementById('signal-recommendation');
    if (recommendationElement) {
      recommendationElement.textContent = signal.recommendation;
      
      if (signal.type === 'buy') {
        recommendationElement.style.color = '#4CAF50';
      } else if (signal.type === 'sell') {
        recommendationElement.style.color = '#F44336';
      } else {
        recommendationElement.style.color = '#FFD700';
      }
    }
    
    // Update indicator details
    if (signal.details) {
      document.getElementById('indicator-ema').textContent = signal.details.ema || '--';
      document.getElementById('indicator-macd').textContent = signal.details.macd || '--';
      document.getElementById('indicator-rsi').textContent = signal.details.rsi || '--';
      document.getElementById('indicator-bb').textContent = signal.details.bb || '--';
      document.getElementById('indicator-volume').textContent = signal.details.volume || '--';
    }
    
    // Update AI confidence
    document.getElementById('ai-confidence').textContent = `${Math.round(signal.aiConfidence * 100)}%`;
    
    console.log('Signal overlay updated:', signal);
  } catch (error) {
    console.error('Error updating signal overlay:', error);
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'signalUpdated':
      if (request.data.timeframe === state.currentTimeframe) {
        updateSignalOverlay(request.data.signal);
      }
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      sendResponse({
        success: true,
        isActive: state.isActive,
        timeframe: state.currentTimeframe,
        observingChart: state.observingChart
      });
      break;
      
    case 'toggleActive':
      state.isActive = request.data.isActive;
      sendResponse({ success: true, isActive: state.isActive });
      
      // If activated, try to extract data immediately
      if (state.isActive) {
        extractCandleData();
      }
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Initialize content script
function initialize() {
  console.log('Quotex AI Trading Signals content script initialized');
  
  // Get initial state from background script
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response && response.success) {
      state.isActive = response.state.isActive;
      state.currentTimeframe = response.state.selectedTimeframe;
      
      console.log('Initial state:', state);
      
      // Start observing for chart
      startObserving();
    }
  });
}

// Start the extension
initialize();
