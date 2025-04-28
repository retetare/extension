/**
 * Data Extractor module for Quotex AI Trading Signals
 * 
 * This module provides functions for extracting candle data from Quotex trading platform.
 * It uses various techniques to access and process the chart data.
 */

/**
 * Extract candle data from Quotex charts
 * @param {string} timeframe - Selected timeframe
 * @returns {Promise<Array>} Promise resolving to candle data array
 */
async function extractCandleData(timeframe) {
  try {
    // Try multiple extraction methods
    let candleData = null;
    
    // Method 1: Extract from window object
    candleData = extractFromWindowObject();
    
    // Method 2: Extract from DOM if window object extraction failed
    if (!candleData || !candleData.length) {
      candleData = extractFromDOM();
    }
    
    // Method 3: Extract from network requests if other methods failed
    if (!candleData || !candleData.length) {
      candleData = await extractFromNetworkRequests(timeframe);
    }
    
    // Process and normalize the data
    if (candleData && candleData.length) {
      return normalizeCandleData(candleData, timeframe);
    }
    
    console.warn('Failed to extract candle data using all methods');
    return null;
  } catch (error) {
    console.error('Error extracting candle data:', error);
    return null;
  }
}

/**
 * Extract candle data from window object
 * @returns {Array|null} Candle data array or null if extraction failed
 */
function extractFromWindowObject() {
  try {
    // Most trading platforms store chart data in the window object
    // This is an exploratory approach to find potential data objects
    
    // Define potential variable names that might contain chart data
    const potentialVarNames = [
      'chartData', 'candleData', 'ohlcData', 'priceData', 
      'quotexData', 'quotexChart', 'tradingData', 'marketData'
    ];
    
    // Check for specific variable names first
    for (const varName of potentialVarNames) {
      if (window[varName] && Array.isArray(window[varName])) {
        const data = window[varName];
        if (data.length > 0 && isCandleDataArray(data)) {
          return data;
        }
      }
    }
    
    // Scan window object for potential arrays containing candle data
    for (const key in window) {
      try {
        const obj = window[key];
        
        // Skip non-objects, functions, and DOM elements
        if (!obj || typeof obj !== 'object' || obj instanceof Node || obj === window || obj === document) {
          continue;
        }
        
        // Check if object has candle data properties
        if (obj.candles && Array.isArray(obj.candles) && obj.candles.length > 0 && isCandleDataArray(obj.candles)) {
          return obj.candles;
        }
        
        if (obj.prices && Array.isArray(obj.prices) && obj.prices.length > 0 && isCandleDataArray(obj.prices)) {
          return obj.prices;
        }
        
        if (obj.ohlc && Array.isArray(obj.ohlc) && obj.ohlc.length > 0 && isCandleDataArray(obj.ohlc)) {
          return obj.ohlc;
        }
        
        // Look in chart or data properties
        if (obj.chart && typeof obj.chart === 'object') {
          if (obj.chart.data && Array.isArray(obj.chart.data) && obj.chart.data.length > 0 && isCandleDataArray(obj.chart.data)) {
            return obj.chart.data;
          }
        }
        
        if (obj.data && Array.isArray(obj.data) && obj.data.length > 0 && isCandleDataArray(obj.data)) {
          return obj.data;
        }
      } catch (e) {
        // Ignore errors when accessing window properties
        continue;
      }
    }
  } catch (error) {
    console.error('Error extracting from window object:', error);
  }
  
  return null;
}

/**
 * Check if an array contains candle data objects
 * @param {Array} arr - Array to check
 * @returns {boolean} True if array contains candle data
 */
function isCandleDataArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return false;
  }
  
  // Check first element for expected properties
  const firstItem = arr[0];
  
  // Check for common OHLC properties
  if (typeof firstItem === 'object' && firstItem !== null) {
    // Type 1: Standard OHLC object with open, high, low, close
    if ('open' in firstItem && 'high' in firstItem && 'low' in firstItem && 'close' in firstItem) {
      return true;
    }
    
    // Type 2: Object with o, h, l, c properties
    if ('o' in firstItem && 'h' in firstItem && 'l' in firstItem && 'c' in firstItem) {
      return true;
    }
    
    // Type 3: Array with OHLC values and timestamp
    if (Array.isArray(firstItem) && firstItem.length >= 5) {
      // Assuming format [timestamp, open, high, low, close]
      return typeof firstItem[0] === 'number' && 
             typeof firstItem[1] === 'number' && 
             typeof firstItem[2] === 'number' && 
             typeof firstItem[3] === 'number' && 
             typeof firstItem[4] === 'number';
    }
  }
  
  return false;
}

/**
 * Extract candle data from DOM elements
 * @returns {Array|null} Candle data array or null if extraction failed
 */
function extractFromDOM() {
  try {
    // Find chart container
    const chartContainer = document.querySelector('.chart-container, .trading-chart, .quote-chart');
    
    if (!chartContainer) {
      return null;
    }
    
    // Find candle elements
    const candleElements = chartContainer.querySelectorAll('.candle, .candlestick, .bar, .ohlc');
    
    if (!candleElements || candleElements.length === 0) {
      return null;
    }
    
    // Extract price scale from axis labels
    const priceScale = extractPriceScale();
    
    if (!priceScale) {
      return null;
    }
    
    // Extract data from candle elements
    const candleData = [];
    const now = Date.now();
    
    // Process candle elements
    candleElements.forEach((element, index) => {
      try {
        // Extract visual properties from element
        const rect = element.getBoundingClientRect();
        
        // Get height and position
        const height = rect.height;
        const top = rect.top - chartContainer.getBoundingClientRect().top;
        
        // Calculate price values based on visual position
        const range = priceScale.max - priceScale.min;
        const pixelsPerPrice = chartContainer.clientHeight / range;
        
        // Estimate OHLC values
        let open, close, high, low;
        
        // Check if candle has specific parts
        const wickElement = element.querySelector('.wick, .high-low');
        const bodyElement = element.querySelector('.body, .open-close') || element;
        
        if (wickElement) {
          // Extract from wick and body elements
          const wickRect = wickElement.getBoundingClientRect();
          const bodyRect = bodyElement.getBoundingClientRect();
          
          high = priceScale.max - ((wickRect.top - chartContainer.getBoundingClientRect().top) / pixelsPerPrice);
          low = priceScale.max - ((wickRect.bottom - chartContainer.getBoundingClientRect().top) / pixelsPerPrice);
          
          if (bodyRect.height > 0) {
            // Determine if bullish or bearish candle
            const isBullish = element.classList.contains('bullish') || 
                              element.classList.contains('up') || 
                              bodyElement.classList.contains('green') ||
                              getComputedStyle(bodyElement).backgroundColor.includes('green');
            
            if (isBullish) {
              open = priceScale.max - ((bodyRect.bottom - chartContainer.getBoundingClientRect().top) / pixelsPerPrice);
              close = priceScale.max - ((bodyRect.top - chartContainer.getBoundingClientRect().top) / pixelsPerPrice);
            } else {
              open = priceScale.max - ((bodyRect.top - chartContainer.getBoundingClientRect().top) / pixelsPerPrice);
              close = priceScale.max - ((bodyRect.bottom - chartContainer.getBoundingClientRect().top) / pixelsPerPrice);
            }
          } else {
            // Doji candle
            open = high - (high - low) / 2;
            close = open;
          }
        } else {
          // Simple estimation based on element position and height
          const midPoint = priceScale.max - ((top + height / 2) / pixelsPerPrice);
          const range = height / pixelsPerPrice;
          
          // Estimate values
          high = midPoint + range / 2;
          low = midPoint - range / 2;
          
          // Determine direction based on element classes
          const isBullish = element.classList.contains('bullish') || 
                            element.classList.contains('up') || 
                            element.classList.contains('green');
          
          if (isBullish) {
            open = low + range * 0.25;
            close = high - range * 0.25;
          } else {
            open = high - range * 0.25;
            close = low + range * 0.25;
          }
        }
        
        // Create candle data object
        const candle = {
          timestamp: now - ((candleElements.length - index) * 60000), // Approximate timestamp
          open: open,
          high: high,
          low: low,
          close: close,
          volume: 0 // Unable to extract volume from DOM
        };
        
        candleData.push(candle);
      } catch (elemError) {
        console.error('Error processing candle element:', elemError);
      }
    });
    
    return candleData;
  } catch (error) {
    console.error('Error extracting from DOM:', error);
    return null;
  }
}

/**
 * Extract price scale information from chart axis
 * @returns {Object|null} Price scale object or null if extraction failed
 */
function extractPriceScale() {
  try {
    // Find price axis labels
    const yAxisLabels = document.querySelectorAll('.y-axis-label, .price-axis-label, .price-label');
    
    if (!yAxisLabels || yAxisLabels.length < 2) {
      // Try to find other elements that might contain price information
      const priceElements = document.querySelectorAll('.price, .rate, .quote-value');
      
      if (priceElements && priceElements.length > 0) {
        // Extract current price
        const currentPriceText = priceElements[0].textContent;
        const currentPrice = parseFloat(currentPriceText.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(currentPrice)) {
          // Create approximate scale based on current price
          return {
            min: currentPrice * 0.95,
            max: currentPrice * 1.05,
            height: document.querySelector('.chart-container, .trading-chart').clientHeight
          };
        }
      }
      
      return null;
    }
    
    // Extract values from labels
    const values = Array.from(yAxisLabels).map(label => {
      const text = label.textContent;
      return parseFloat(text.replace(/[^\d.-]/g, ''));
    }).filter(val => !isNaN(val));
    
    if (values.length < 2) {
      return null;
    }
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      height: document.querySelector('.chart-container, .trading-chart').clientHeight
    };
  } catch (error) {
    console.error('Error extracting price scale:', error);
    return null;
  }
}

/**
 * Extract candle data by intercepting network requests
 * @param {string} timeframe - Selected timeframe
 * @returns {Promise<Array>} Promise resolving to candle data array
 */
async function extractFromNetworkRequests(timeframe) {
  // This is a placeholder implementation
  // In a real extension, we would need to use a background script with webRequest API
  // to intercept and analyze network requests
  
  // For now, return null to indicate this method failed
  return null;
}

/**
 * Normalize candle data to a standard format
 * @param {Array} data - Raw candle data
 * @param {string} timeframe - Selected timeframe
 * @returns {Array} Normalized candle data array
 */
function normalizeCandleData(data, timeframe) {
  if (!data || data.length === 0) {
    return [];
  }
  
  try {
    const normalizedData = [];
    const interval = getTimeframeInMs(timeframe);
    let timestamp = Date.now() - (data.length * interval);
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      
      // Handle different data formats
      let candle = {};
      
      if (Array.isArray(item)) {
        // Format: [timestamp, open, high, low, close, volume?]
        candle = {
          timestamp: item[0] || timestamp,
          open: item[1],
          high: item[2],
          low: item[3],
          close: item[4],
          volume: item[5] || 0
        };
      } else if (typeof item === 'object') {
        // Format 1: {open, high, low, close, time/timestamp, volume?}
        if ('open' in item) {
          candle = {
            timestamp: item.timestamp || item.time || timestamp,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume || 0
          };
        } 
        // Format 2: {o, h, l, c, t/ts, v?}
        else if ('o' in item) {
          candle = {
            timestamp: item.t || item.ts || timestamp,
            open: item.o,
            high: item.h,
            low: item.l,
            close: item.c,
            volume: item.v || 0
          };
        }
      }
      
      // Validate candle data
      if (isValidCandle(candle)) {
        normalizedData.push(candle);
      }
      
      // Increment timestamp for next candle
      timestamp += interval;
    }
    
    return normalizedData;
  } catch (error) {
    console.error('Error normalizing candle data:', error);
    return [];
  }
}

/**
 * Validate candle data object
 * @param {Object} candle - Candle data object
 * @returns {boolean} True if candle data is valid
 */
function isValidCandle(candle) {
  return candle.open !== undefined && 
         candle.high !== undefined && 
         candle.low !== undefined && 
         candle.close !== undefined && 
         !isNaN(candle.open) && 
         !isNaN(candle.high) && 
         !isNaN(candle.low) && 
         !isNaN(candle.close);
}

/**
 * Convert timeframe to milliseconds
 * @param {string} timeframe - Timeframe string (M1, M5, M15)
 * @returns {number} Timeframe in milliseconds
 */
function getTimeframeInMs(timeframe) {
  switch (timeframe) {
    case 'M1': return 60 * 1000;
    case 'M5': return 5 * 60 * 1000;
    case 'M15': return 15 * 60 * 1000;
    default: return 60 * 1000;
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractCandleData,
    extractFromWindowObject,
    extractFromDOM,
    extractFromNetworkRequests,
    normalizeCandleData
  };
}
