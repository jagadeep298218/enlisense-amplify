/**
 * FILE: AGPReport.js
 * PURPOSE: Ambulatory Glucose/Cortisol Profile (AGP/ACP) Report Component
 * DESCRIPTION: Generates comprehensive biomarker analysis reports with visual charts, statistics,
 *              and downloadable formats (PDF, CSV). Supports both glucose and cortisol biomarkers
 *              with customizable range configurations and time-in-range analysis.
 * 
 * FEATURES:
 * - Interactive AGP/ACP charts with percentile displays
 * - Time-in-range analysis with visual bar charts
 * - Additional metrics dashboard (A1C, GMI, CV, etc.)
 * - PDF report generation with html2canvas
 * - CSV export of additional metrics
 * - Biomarker switching (glucose/cortisol)
 * - Custom range support with auto-detection
 * - Embed mode for integration in other components
 * 
 * DEPENDENCIES:
 * - @mui/material: UI components and theming
 * - react-plotly.js: Interactive charts and graphs
 * - html2canvas: PDF generation from DOM elements
 * - jspdf: PDF creation and download
 * 
 * ERROR HANDLING:
 * - [CRITICAL] No fallback for failed API calls - Users see blank screen
 *   FIX: Add retry mechanism and offline state handling
 * - [HIGH] PDF generation may fail on large datasets or complex DOM
 *   FIX: Add progress indicators and chunking for large reports
 * - [MEDIUM] Date parsing errors not handled - Invalid dates crash component
 *   FIX: Add date validation and fallback formatting
 * - [LOW] CSV generation assumes all data fields exist
 *   FIX: Add null checks and default values for missing data
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import config from "../config";
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Paper
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import AssessmentIcon from "@mui/icons-material/Assessment";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * COMPONENT: AGPReport
 * PURPOSE: Main report component for ambulatory biomarker profile analysis
 * 
 * PROPS:
 * - username: string (optional) - Patient username, if not provided uses URL param
 * - embedMode: boolean (default: false) - Whether component is embedded in another view
 * 
 * STATE MANAGEMENT:
 * - patientData: Complete patient biomarker data from API
 * - loading: Boolean for async operation states
 * - error: Error message string for user feedback
 * - biomarkerType: 'glucose' | 'cortisol' - Current biomarker being analyzed
 * - customRanges: Custom range configuration when available
 * - applicableRanges: Auto-detected range settings
 * - isDownloading: Boolean for PDF generation state
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - useMemo for expensive calculations (range thresholds, chart data)
 * - useCallback for event handlers to prevent unnecessary re-renders
 * - Memoized chart configurations to avoid recreation
 */
function AGPReport({ username: usernameProp, embedMode = false }) {
  const { username: usernameParam } = useParams();
  const navigate = useNavigate();
  const username = usernameProp || usernameParam;
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [biomarkerType, setBiomarkerType] = useState('glucose');
  const [customRanges, setCustomRanges] = useState(null);
  const [applicableRanges, setApplicableRanges] = useState(null);
  const [rangeMessage, setRangeMessage] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPaidUser, setIsPaidUser] = useState(false);
  const [paidStatusChecked, setPaidStatusChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const reportRef = useRef();

  /**
   * MEMOIZED CALCULATION: Range Thresholds and Chart Configuration
   * PURPOSE: Calculate range thresholds, labels, colors, and values for charts
   * DEPENDENCIES: [customRanges, biomarkerType, patientData?.statistics]
   * OPTIMIZATION: Complex calculations memoized to prevent expensive recalculations
   * 
   * ERROR HANDLING:
   * - [MEDIUM] Missing statistics data handled with fallback values
   * - [LOW] Invalid range configurations default to standard ranges
   */
  const chartConfiguration = useMemo(() => {
    if (!patientData?.statistics) {
      return {
        ranges: null,
        rangeValues: [],
        rangeLabels: [],
        rangeColors: [],
        unit: biomarkerType === 'glucose' ? 'mg/dL' : 'ng/mL'
      };
    }

    // Get range thresholds from database or fallback to defaults
    let ranges;
    if (customRanges && Object.keys(customRanges).length > 0) {
      // Use ranges from s3-mongodb-csv2ranges collection
      ranges = customRanges;
      console.log('Using database ranges for', biomarkerType, ':', ranges);
    } else {
      // Fallback to hardcoded defaults only if no database ranges are available
      ranges = biomarkerType === 'glucose' ? {
        veryLow: { min: 0, max: 54 },
        low: { min: 54, max: 70 },
        target: { min: 70, max: 180 },
        high: { min: 180, max: 250 },
        veryHigh: { min: 250, max: 400 }
      } : {
        veryLow: { min: 0, max: 5 },
        low: { min: 5, max: 10 },
        normal: { min: 10, max: 30 },
        high: { min: 30, max: 50 },
        veryHigh: { min: 50, max: 100 }
      };
      console.log('Using fallback ranges - no database ranges available:', ranges);
    }

    let rangeValues, rangeLabels, rangeColors, unit;
    
    if (biomarkerType === 'glucose') {
      // Safe extraction of thresholds with fallbacks
      const veryLowThreshold = ranges?.veryLow?.max || 54;
      const lowThreshold = ranges?.low?.max || 70;
      const targetMin = ranges?.target?.min || 70;
      const targetMax = ranges?.target?.max || 180;
      const highThreshold = ranges?.high?.max || 250;
      
      // Extract percentages with safe fallbacks
      const stats = patientData.statistics;
      const veryLowPercent = stats.percentBelow54 || 0;
      const lowPercent = Math.max(0, (stats.percentBelow70 || 0) - veryLowPercent);
      const targetPercent = stats.percentBetween70And180 || 0;
      const highPercent = Math.max(0, (stats.percentAbove180 || 0) - (stats.percentAbove250 || 0));
      const veryHighPercent = stats.percentAbove250 || 0;
      
      rangeValues = [veryLowPercent, lowPercent, targetPercent, highPercent, veryHighPercent];
      rangeLabels = [
        `Very Low<br><${veryLowThreshold}`,
        `Low<br>${veryLowThreshold}-${lowThreshold}`,
        `Target<br>${targetMin}-${targetMax}`,
        `High<br>${targetMax}-${highThreshold}`,
        `Very High<br>>${highThreshold}`
      ];
      rangeColors = ["#dc2626", "#f59e0b", "#10b981", "#f59e0b", "#dc2626"];
      unit = "mg/dL";
    } else {
      // Cortisol configuration
      const veryLowThreshold = ranges?.veryLow?.max || 2;
      const lowThreshold = ranges?.low?.max || 5;
      const normalMin = ranges?.normal?.min || 5;
      const normalMax = ranges?.normal?.max || 15;
      const highThreshold = ranges?.high?.max || 20;
      
      const stats = patientData.statistics;
      const veryLowPercent = stats.percentBelow5 || 0;
      const lowPercent = Math.max(0, (stats.percentBelow10 || 0) - veryLowPercent);
      const normalPercent = stats.percentBetween10And30 || 0;
      const highPercent = Math.max(0, (stats.percentAbove30 || 0) - (stats.percentAbove50 || 0));
      const veryHighPercent = stats.percentAbove50 || 0;
      
      rangeValues = [veryLowPercent, lowPercent, normalPercent, highPercent, veryHighPercent];
      rangeLabels = [
        `Very Low<br><${veryLowThreshold}`,
        `Low<br>${veryLowThreshold}-${lowThreshold}`,
        `Normal<br>${normalMin}-${normalMax}`,
        `High<br>${normalMax}-${highThreshold}`,
        `Very High<br>>${highThreshold}`
      ];
      rangeColors = ["#3b82f6", "#60a5fa", "#10b981", "#f59e0b", "#dc2626"];
      unit = "ng/mL";
    }

    return { ranges, rangeValues, rangeLabels, rangeColors, unit };
  }, [customRanges, biomarkerType, patientData?.statistics]);

  /**
   * FUNCTION: formatTime
   * PURPOSE: Convert minutes to human-readable "Xh Ymin" format
   * PARAMETERS: minutes - Number of minutes to format
   * OPTIMIZATION: Memoized to prevent function recreation on every render
   * 
   * ERROR HANDLING:
   * - [LOW] Invalid/null inputs return "0h 0min"
   */
  const formatTime = useCallback((minutes) => {
    if (!minutes || isNaN(minutes) || minutes < 0) return '0h 0min';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  }, []);

  /**
   * FUNCTION: checkUserPermissions
   * PURPOSE: Check if current user has access for downloads (paid user or admin)
   * DEPENDENCIES: username
   */
  const checkUserPermissions = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log('No token found for permission check');
        return { canDownload: false, isAdmin: false, isPaidUser: false };
      }

      // Check user info from stored user data
      const storedUser = localStorage.getItem('user');
      let userIsAdmin = false;
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          userIsAdmin = userData.admin || false;
          setIsAdmin(userIsAdmin);
        } catch (e) {
          console.warn('Failed to parse stored user data');
        }
      }

      // If admin, they can always download
      if (userIsAdmin) {
        console.log('User is admin - allowing download');
        setIsPaidUser(true); // Set to true for UI consistency
        setPaidStatusChecked(true);
        return { canDownload: true, isAdmin: true, isPaidUser: true };
      }

      // If not admin, check paid status
      console.log('Checking paid status...');
      const response = await fetch(`${config.API_URL}/user/paid-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Paid status response:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Paid status data:', data);
        const isPaid = data.paid_user || false;
        setIsPaidUser(isPaid);
        setPaidStatusChecked(true);
        return { canDownload: isPaid, isAdmin: false, isPaidUser: isPaid };
      } else {
        console.log('Paid status check failed:', response.status, response.statusText);
      }
      
      setPaidStatusChecked(true);
      return { canDownload: false, isAdmin: false, isPaidUser: false };
    } catch (error) {
      console.error('Error checking user permissions:', error);
      setIsPaidUser(false);
      setPaidStatusChecked(true);
      setIsAdmin(false);
      return { canDownload: false, isAdmin: false, isPaidUser: false };
    }
  }, []);

  /**
   * FUNCTION: downloadCSV
   * PURPOSE: Export additional metrics as CSV file with patient data
   * DEPENDENCIES: patientData, biomarkerType, username, isPaidUser
   * 
   * PROCESS:
   * 1. Check if user has paid access
   * 2. Calculate CGM active percentage from wear time vs. total possible time
   * 3. Format date range from actual data timestamps
   * 4. Build metrics array with proper null handling
   * 5. Generate CSV content and trigger download
   * 
   * ERROR HANDLING:
   * - [HIGH] Date parsing errors can crash function
   * - [MEDIUM] Missing statistics fields cause undefined values
   * - [LOW] Blob creation may fail in older browsers
   */
  const downloadCSV = useCallback(async () => {
    // Check user permissions before allowing download
    if (!isPaidUser && !isAdmin) {
      const permissions = await checkUserPermissions();
      if (!permissions.canDownload) {
        const message = permissions.isAdmin ? 
          'Download failed. Please try again.' : 
          'CSV download is a premium feature. Please contact your administrator to upgrade to a paid account.';
        alert(message);
        return;
      }
    }
    try {
      // Validate required data before processing
      if (!patientData || !patientData.statistics) {
        throw new Error('Patient data or statistics not available');
      }

      // Safe date parsing with fallbacks
      let startDate, endDate, dateRange;
      try {
        startDate = new Date(patientData.startAt);
        endDate = new Date(patientData.endAt);
        
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format');
        }
        
        dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      } catch (dateError) {
        console.warn('Date parsing failed, using fallback:', dateError);
        dateRange = 'Date range unavailable';
      }

      // Calculate CGM Active percentage with safe math
      let cgmActivePercentage = 'N/A';
      try {
        if (startDate && endDate) {
          const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          const totalPossibleMinutes = totalDays * 24 * 60;
          const actualWearTimeMinutes = patientData.statistics.totalWearTimeMinutes || 0;
          
          if (totalPossibleMinutes > 0) {
            cgmActivePercentage = `${Math.round((actualWearTimeMinutes / totalPossibleMinutes) * 100)}%`;
          }
        }
      } catch (calcError) {
        console.warn('CGM percentage calculation failed:', calcError);
      }

      // Safe value extraction with defaults
      const getStatValue = (key, defaultValue = 'N/A', unit = '') => {
        const value = patientData.statistics[key];
        return value !== undefined && value !== null ? `${value}${unit}` : defaultValue;
      };

      // Build metrics array with safe data access
      const metrics = [
        ['Metric', 'Value'],
        ['Date Range', dateRange],
        ['CGM Active', cgmActivePercentage],
        [
          `Average ${biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'}`, 
          getStatValue('average', 'N/A', ` ${biomarkerType === 'glucose' ? 'mg/dL' : 'ng/mL'}`)
        ],
        ['Coefficient of Variation', getStatValue('coefficientOfVariationPercentage', 'N/A', '%')]
      ];
      
      // Add glucose-specific metrics with null checks
      if (biomarkerType === 'glucose') {
        metrics.push(['Estimated A1C', getStatValue('a1c', 'N/A', '%')]);
        metrics.push(['GMI', getStatValue('gmi', 'N/A', '%')]);
      }
      
      // Convert to CSV format with proper escaping
      const csvContent = metrics.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Check if Blob is supported
      if (!window.Blob) {
        throw new Error('CSV download not supported in this browser');
      }
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate safe filename
      const patientName = (patientData?.patientInfo?.name || username || 'Patient')
        .replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const biomarkerTypeCapitalized = biomarkerType.charAt(0).toUpperCase() + biomarkerType.slice(1);
      const filename = `${patientName}_${biomarkerTypeCapitalized}_AGP_Additional_Metrics_${date}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error generating CSV:', error);
      // More specific error messaging
      const errorMessage = error.message.includes('not available') 
        ? 'Patient data is not fully loaded. Please wait and try again.'
        : 'Error generating CSV file. Please check your browser settings and try again.';
      alert(errorMessage);
    }
  }, [patientData, biomarkerType, username, isPaidUser, isAdmin, checkUserPermissions]);

  /**
   * FUNCTION: downloadPDF
   * PURPOSE: Generate and download PDF report from current DOM state
   * DEPENDENCIES: reportRef, html2canvas, jsPDF, patientData, isPaidUser
   * 
   * PROCESS:
   * 1. Check if user has paid access
   * 2. Hide interactive elements (.pdf-hide class)
   * 3. Capture DOM as high-resolution canvas
   * 4. Calculate optimal PDF dimensions for A4 format
   * 5. Generate PDF and trigger download
   * 6. Restore UI state
   * 
   * ERROR HANDLING:
   * - [CRITICAL] html2canvas may fail on complex DOM structures
   * - [HIGH] Large reports may exceed memory limits
   * - [MEDIUM] Element selection could fail if DOM changes
   * - [LOW] PDF library may not support certain image formats
   */
  const downloadPDF = useCallback(async () => {
    // Check user permissions before allowing download
    if (!isPaidUser && !isAdmin) {
      const permissions = await checkUserPermissions();
      if (!permissions.canDownload) {
        const message = permissions.isAdmin ? 
          'Download failed. Please try again.' : 
          'PDF download is a premium feature. Please contact your administrator to upgrade to a paid account.';
        alert(message);
        return;
      }
    }
    try {
      setIsDownloading(true);
      
      // Validate report element exists
      const element = reportRef.current;
      if (!element) {
        throw new Error('Report element not found - cannot generate PDF');
      }

      // Hide interactive elements before capturing
      const elementsToHide = element.querySelectorAll('.pdf-hide');
      elementsToHide.forEach(el => {
        el.style.display = 'none';
      });

      // Configure html2canvas with optimized settings
      const canvasOptions = {
        scale: 2, // Higher resolution for better quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        logging: false, // Disable console logs
        imageTimeout: 15000, // 15 second timeout for images
      };

      let canvas;
      try {
        canvas = await html2canvas(element, canvasOptions);
      } catch (canvasError) {
        throw new Error(`Failed to capture report: ${canvasError.message}`);
      }

      // Restore hidden elements immediately after capturing
      elementsToHide.forEach(el => {
        el.style.display = '';
      });

      // Validate canvas creation
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Generated canvas is invalid or empty');
      }

      // Generate PDF with optimized dimensions
      const imgData = canvas.toDataURL('image/png', 0.95); // Slight compression
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // A4 dimensions in mm with margins
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const maxWidth = pdfWidth - (2 * margin);
      const maxHeight = pdfHeight - (2 * margin);
      
      // Calculate optimal image dimensions
      const aspectRatio = canvas.width / canvas.height;
      let finalWidth = maxWidth;
      let finalHeight = maxWidth / aspectRatio;
      
      // If height exceeds page, scale down
      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = maxHeight * aspectRatio;
      }
      
      // Center the image on the page
      const x = (pdfWidth - finalWidth) / 2;
      const y = margin;
      
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      
      // Generate safe filename
      const patientName = (patientData?.patientInfo?.name || username || 'Patient')
        .replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const biomarkerTypeCapitalized = biomarkerType.charAt(0).toUpperCase() + biomarkerType.slice(1);
      const filename = `${patientName}_${biomarkerTypeCapitalized}_AGP_Report_${date}.pdf`;
      
      pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Provide specific error messages
      let errorMessage = 'Error generating PDF. ';
      if (error.message.includes('not found')) {
        errorMessage += 'Report is not ready. Please wait for the report to fully load.';
      } else if (error.message.includes('capture')) {
        errorMessage += 'Failed to capture report. Try scrolling to top and try again.';
      } else if (error.message.includes('canvas')) {
        errorMessage += 'Report is too complex to convert. Try refreshing the page.';
      } else {
        errorMessage += 'Please try again or contact support if the issue persists.';
      }
      
      alert(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [patientData, biomarkerType, username, isPaidUser, isAdmin, checkUserPermissions]);

  /**
   * EFFECT: Data Fetching for AGP/ACP Report
   * PURPOSE: Fetch patient biomarker data and applicable range configurations
   * DEPENDENCIES: [username, biomarkerType] - Refetches when either changes
   * 
   * PROCESS:
   * 1. Validate authentication token
   * 2. Parallel fetch of AGP data and range configurations
   * 3. Process and set data with fallbacks for missing ranges
   * 4. Handle errors gracefully with user feedback
   * 
   * ERROR HANDLING:
   * - [CRITICAL] Network failures leave users with no data
   * - [HIGH] Invalid usernames cause 404 errors
   * - [MEDIUM] Token expiration not detected
   * - [LOW] Range configuration failures are non-blocking
   */
  useEffect(() => {
    /**
     * FUNCTION: fetchAGPData
     * PURPOSE: Internal async function to fetch all required data
     * OPTIMIZATION: Uses Promise.all for parallel API calls
     */
    const fetchAGPData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors
        
        // Validate authentication
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Authentication required. Please log in again.");
        }

        // Validate required parameters
        if (!username || !biomarkerType) {
          throw new Error("Missing required parameters for data fetching");
        }

        // Construct API endpoints
        const agpEndpoint = biomarkerType === 'glucose' 
          ? `${config.API_URL}/user-glucose-agp/${encodeURIComponent(username)}`
          : `${config.API_URL}/user-cortisol-agp/${encodeURIComponent(username)}`;
          
        const rangesEndpoint = `${config.API_URL}/user-applicable-ranges/${encodeURIComponent(username)}/${biomarkerType}`;

        const requestHeaders = { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // Parallel data fetching with timeout protection
        const fetchWithTimeout = (url, options, timeout = 30000) => {
          return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
        };

        const [agpResponse, applicableRangesResponse] = await Promise.all([
          fetchWithTimeout(agpEndpoint, { headers: requestHeaders }),
          fetchWithTimeout(rangesEndpoint, { headers: requestHeaders })
            .catch(error => {
              console.warn('Ranges fetch failed (non-critical):', error);
              return null; // Non-blocking failure
            })
        ]);

        // Validate main AGP response
        if (!agpResponse.ok) {
          if (agpResponse.status === 401) {
            throw new Error("Authentication expired. Please log in again.");
          } else if (agpResponse.status === 404) {
            throw new Error(`No data found for user: ${username}`);
          } else if (agpResponse.status >= 500) {
            throw new Error("Server error. Please try again later.");
          } else {
            throw new Error(`Failed to load data (${agpResponse.status})`);
          }
        }

        let agpData;
        try {
          agpData = await agpResponse.json();
        } catch (parseError) {
          throw new Error("Invalid data format received from server");
        }

        // Validate essential data structure
        if (!agpData || !agpData.statistics) {
          throw new Error("Incomplete data received. Please try again.");
        }

        setPatientData(agpData);

        // Process range configurations (optional)
        if (applicableRangesResponse && applicableRangesResponse.ok) {
          try {
            const rangesData = await applicableRangesResponse.json();
            setApplicableRanges(rangesData);
            
            if (!rangesData.useDefault && rangesData.ranges) {
              setCustomRanges(rangesData.ranges);
              setRangeMessage(rangesData.message || '');
            } else {
              setCustomRanges(null);
              setRangeMessage(rangesData.message || '');
            }
          } catch (rangeParseError) {
            console.warn('Failed to parse range data:', rangeParseError);
            // Continue without custom ranges
            setApplicableRanges(null);
            setCustomRanges(null);
            setRangeMessage('');
          }
        } else {
          // Reset range configurations
          setApplicableRanges(null);
          setCustomRanges(null);
          setRangeMessage('');
        }

      } catch (error) {
        console.error("Error fetching AGP data:", error);
        
        // Set user-friendly error messages
        const errorMessage = error.message || "An unexpected error occurred";
        setError(errorMessage);
        
        // Clear data on error
        setPatientData(null);
        setApplicableRanges(null);
        setCustomRanges(null);
        setRangeMessage('');
        
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have a username
    if (username) {
      fetchAGPData();
      // Check user permissions in parallel
      checkUserPermissions();
    } else {
      setLoading(false);
      setError("No username provided");
    }
  }, [username, biomarkerType, checkUserPermissions]);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading AGP data: {error}</Alert>
      </Container>
    );
  }

  if (!patientData) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="warning">No data available for this patient.</Alert>
      </Container>
    );
  }

  // Destructure chart configuration for use in render
  const { ranges, rangeValues, rangeLabels, rangeColors, unit } = chartConfiguration;

  // AGP Chart Data for Plotly - Filter out time points with no data
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  // Helper function to filter out null/undefined/zero values and corresponding x values
  const filterValidDataPoints = (xValues, yValues) => {
    const validPairs = [];
    for (let i = 0; i < xValues.length && i < yValues.length; i++) {
      const yValue = yValues[i];
      // Only include data points that have valid values (not null, undefined, NaN, or zero/very small values)
      // For glucose, values should be > 10, for cortisol > 0.1 to be considered real data
      const minThreshold = biomarkerType === 'glucose' ? 10 : 0.1;
      if (yValue !== null && yValue !== undefined && !isNaN(yValue) && yValue > minThreshold) {
        validPairs.push({ x: xValues[i], y: yValue });
      }
    }
    return {
      x: validPairs.map(pair => pair.x),
      y: validPairs.map(pair => pair.y)
    };
  };

  // Debug: Log the original data to see what we're working with
  console.log('Original percentile data:', {
    percentile_95: patientData.percentages.percentile_95,
    percentile_75: patientData.percentages.percentile_75,
    percentile_50: patientData.percentages.percentile_50,
    percentile_25: patientData.percentages.percentile_25,
    percentile_5: patientData.percentages.percentile_5
  });

  // More aggressive approach: Look for data variation and consecutive identical values
  const processPercentileData = (yValues) => {
    if (!yValues || !Array.isArray(yValues)) {
      return new Array(24).fill(null);
    }

    const processedValues = yValues.map((value, index) => {
      // Convert to number and check validity
      const numValue = Number(value);
      
      // If it's not a valid number, return null
      if (isNaN(numValue) || numValue === null || numValue === undefined) {
        return null;
      }

      // For glucose, consider very low values as missing data
      if (biomarkerType === 'glucose' && numValue < 20) {
        return null;
      }
      
      // For cortisol, consider very low values as missing data  
      if (biomarkerType === 'cortisol' && numValue < 0.5) {
        return null;
      }

      return numValue;
    });

    // Check for flat lines (consecutive identical values) and convert to nulls
    const result = [...processedValues];
    let flatLineStart = -1;
    
    for (let i = 0; i < result.length; i++) {
      if (result[i] === null) continue;
      
      // Look ahead to see if we have a sequence of identical values
      let identicalCount = 1;
      let j = i + 1;
      
      while (j < result.length && result[j] === result[i]) {
        identicalCount++;
        j++;
      }
      
      // If we have 6+ consecutive identical values, it's likely a flat line artifact
      if (identicalCount >= 6) {
        console.log(`Found flat line of ${identicalCount} identical values (${result[i]}) from hour ${i} to ${j-1}`);
        // Convert the flat line to nulls except for the first and last points
        for (let k = i + 1; k < j - 1; k++) {
          result[k] = null;
        }
        i = j - 1; // Skip ahead
      }
    }

    return result;
  };

  // Process data arrays to remove flat lines and invalid data
  const percentile95Values = processPercentileData(patientData.percentages.percentile_95);
  const percentile75Values = processPercentileData(patientData.percentages.percentile_75);
  const percentile50Values = processPercentileData(patientData.percentages.percentile_50);
  const percentile25Values = processPercentileData(patientData.percentages.percentile_25);
  const percentile5Values = processPercentileData(patientData.percentages.percentile_5);

  console.log('Processed percentile data:', {
    percentile_95: percentile95Values,
    percentile_50: percentile50Values,
    percentile_5: percentile5Values
  });

  const agpData = [
    {
      x: hourLabels,
      y: percentile95Values,
      name: "95th Percentile",
      line: { color: "#e5e7eb", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(229, 231, 235, 0.2)",
      connectgaps: false,
      hovertemplate: `<b>95th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: percentile75Values,
      name: "75th Percentile",
      line: { color: "#9ca3af", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(156, 163, 175, 0.3)",
      connectgaps: false,
      hovertemplate: `<b>75th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: percentile50Values,
      name: "Median (50th)",
      line: { color: "#374151", width: 3 },
      mode: "lines",
      connectgaps: false,
      hovertemplate: `<b>Median</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: percentile25Values,
      name: "25th Percentile",
      line: { color: "#9ca3af", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(156, 163, 175, 0.3)",
      connectgaps: false,
      hovertemplate: `<b>25th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: percentile5Values,
      name: "5th Percentile",
      line: { color: "#e5e7eb", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(229, 231, 235, 0.2)",
      connectgaps: false,
      hovertemplate: `<b>5th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
  ];

  const agpLayout = {
    title: {
      text: biomarkerType === 'glucose' 
        ? "Ambulatory Glucose Profile (AGP)" 
        : "Ambulatory Cortisol Profile (ACP)",
      font: { size: 16 },
    },
    xaxis: {
      title: "Time of Day",
      tickmode: "array",
      tickvals: [0, 6, 12, 18, 23],
      ticktext: ["12am", "6am", "12pm", "6pm", "11pm"],
    },
    yaxis: {
      title: `${biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'} (${unit})`,
      range: biomarkerType === 'glucose' ? [0, 400] : [0, 20],
    },
    margin: { l: 60, r: 40, t: 80, b: 60 },
    height: 400,
    showlegend: true,
    legend: {
      x: 0,
      y: 1,
      bgcolor: "rgba(255,255,255,0.8)",
    },
    shapes: biomarkerType === 'glucose' ? [
      {
        type: "rect",
        x0: 0,
        x1: 23,
        y0: ranges?.target?.min || 70,
        y1: ranges?.target?.max || 180,
        fillcolor: "rgba(16, 185, 129, 0.1)",
        line: { color: "rgba(16, 185, 129, 0.3)", width: 1 },
        layer: "below",
      },
    ] : [
      {
        type: "rect",
        x0: 0,
        x1: 23,
        y0: ranges?.normal?.min || 5,
        y1: ranges?.normal?.max || 15,
        fillcolor: "rgba(16, 185, 129, 0.1)",
        line: { color: "rgba(16, 185, 129, 0.3)", width: 1 },
        layer: "below",
      },
    ],
  };

  return (
    <Container maxWidth="xl" sx={{ py: embedMode ? 0 : 4 }}>
      {/* PDF Capture Container */}
      <Box ref={reportRef}>
      {/* Header - only shown when not in embed mode */}
      {!embedMode && (
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {/* Page Header */}
          <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AssessmentIcon sx={{ fontSize: 40 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight="bold">
                  {biomarkerType === 'glucose' ? 'AGP Report: Continuous Glucose Monitoring' : 'ACP Report: Continuous Cortisol Monitoring'}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                  {patientData.patientInfo ? 
                    `Patient: ${patientData.patientInfo.name} | Age: ${patientData.patientInfo.age} | Gender: ${patientData.patientInfo.gender}` :
                    'Advanced ambulatory glucose profile analysis and reporting'
                  }
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }} className="pdf-hide">
                <ToggleButtonGroup
                  value={biomarkerType}
                  exclusive
                  onChange={(event, newBiomarker) => {
                    if (newBiomarker !== null) {
                      setBiomarkerType(newBiomarker);
                    }
                  }}
                  aria-label="biomarker type"
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                >
                  <ToggleButton value="glucose" aria-label="glucose" sx={{ color: 'white' }}>
                    Glucose
                  </ToggleButton>
                  <ToggleButton value="cortisol" aria-label="cortisol" sx={{ color: 'white' }}>
                    Cortisol
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {/* Auto-detected conditions display */}
                {applicableRanges && !applicableRanges.useDefault && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      Auto-detected: {applicableRanges.configsUsed?.join(', ') || 'Custom ranges'}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }} className="pdf-hide">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/")}
            >
              Back to Dashboard
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={downloadPDF}
              disabled={isDownloading}
              variant="outlined"
              color="primary"
              title={!isPaidUser && !isAdmin && paidStatusChecked ? 'PDF download requires paid access' : ''}
            >
              {isDownloading ? 'Generating PDF...' : 'Download PDF'}
              {!isPaidUser && !isAdmin && paidStatusChecked && <span style={{ marginLeft: '4px', fontSize: '0.8em' }}>🔒</span>}
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={downloadCSV}
              variant="outlined"
              color="secondary"
              title={!isPaidUser && !isAdmin && paidStatusChecked ? 'CSV download requires paid access' : ''}
            >
              Download CSV
              {!isPaidUser && !isAdmin && paidStatusChecked && <span style={{ marginLeft: '4px', fontSize: '0.8em' }}>🔒</span>}
            </Button>
          </Box>
          
          {patientData.patientInfo && (
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Patient: {patientData.patientInfo.name} | Age: {patientData.patientInfo.age} | 
              Gender: {patientData.patientInfo.gender} | Device: {patientData.patientInfo.device}
            </Typography>
          )}
          
          <Typography variant="body1" color="textSecondary">
            <strong>From:</strong> {new Date(patientData.startAt).toLocaleDateString()} - {new Date(patientData.endAt).toLocaleDateString()}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            15 minutes {biomarkerType} readings (mean of dual sensors)
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 'bold' }}>
            <strong>Total Device Wear Time:</strong> {patientData.statistics.totalWearTimeHours?.toFixed(1) || 'N/A'} hours 
            ({patientData.statistics.totalWearTimeMinutes || 'N/A'} minutes)
          </Typography>
          {rangeMessage && (
            <Alert severity={applicableRanges?.useDefault ? "warning" : "info"} sx={{ mt: 2 }}>
              {rangeMessage}
            </Alert>
          )}
        </Container>
      )}
      
      {/* Biomarker toggle for embed mode */}
      {embedMode && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }} className="pdf-hide">
          <ToggleButtonGroup
            value={biomarkerType}
            exclusive
            onChange={(event, newBiomarker) => {
              if (newBiomarker !== null) {
                setBiomarkerType(newBiomarker);
              }
            }}
            aria-label="biomarker type"
            size="small"
          >
            <ToggleButton value="glucose" aria-label="glucose">
              Glucose
            </ToggleButton>
            <ToggleButton value="cortisol" aria-label="cortisol">
              Cortisol
            </ToggleButton>
          </ToggleButtonGroup>
          
          {/* Download PDF Button for embed mode */}
          <Button
            startIcon={<DownloadIcon />}
            onClick={downloadPDF}
            disabled={isDownloading}
            variant="outlined"
            color="primary"
            size="small"
            title={!isPaidUser && !isAdmin && paidStatusChecked ? 'PDF download requires paid access' : ''}
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
            {!isPaidUser && !isAdmin && paidStatusChecked && <span style={{ marginLeft: '4px', fontSize: '0.8em' }}>🔒</span>}
          </Button>
          
          {/* Download CSV Button for embed mode */}
          <Button
            startIcon={<DownloadIcon />}
            onClick={downloadCSV}
            variant="outlined"
            color="secondary"
            size="small"
            title={!isPaidUser && !isAdmin && paidStatusChecked ? 'CSV download requires paid access' : ''}
          >
            Download CSV
            {!isPaidUser && !isAdmin && paidStatusChecked && <span style={{ marginLeft: '4px', fontSize: '0.8em' }}>🔒</span>}
          </Button>
          
          {/* Auto-detected conditions display for embed mode */}
          {applicableRanges && !applicableRanges.useDefault && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                Auto-detected: {applicableRanges.configsUsed?.join(', ') || 'Custom ranges'}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Centered Grid Container */}
      <Grid container spacing={3} sx={{ 
        justifyContent: 'center', 
        alignItems: 'flex-start',
        maxWidth: '1400px',
        margin: '0 auto',
        px: 2
      }}>
  {/* TIME IN RANGES */}
  <Grid item xs={12} md={6}>
    <Card sx={{ height: 500, margin: '0 auto', width: '100%', maxWidth: 600 }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: '100%', mb: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ 
            backgroundColor: '#333', 
            color: 'white', 
            p: 1.5, 
            fontSize: '16px',
            letterSpacing: '2px',
            textAlign: 'center',
            width: '100%'
          }}>
            TIME IN RANGES
          </Typography>
          {customRanges && (
            <Typography variant="caption" sx={{ 
              display: 'block',
              textAlign: 'center',
              bgcolor: 'info.main',
              color: 'white',
              py: 0.5,
              fontSize: '11px'
            }}>
              ✓ Using Custom Ranges (Backend Calculated)
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center', width: '95%' }}>
          {/* Y-axis labels - Percentage scale */}
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 350, py: 1, minWidth: 40 }}>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>100%</Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>80%</Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>60%</Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>40%</Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>20%</Typography>
            <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>0%</Typography>
          </Box>
          
          {/* Stacked Bar */}
          <Box sx={{ width: 100, height: 350, position: 'relative', border: '2px solid #333', borderRadius: 1 }}>
            {rangeValues.slice().reverse().map((value, reverseIndex) => {
              const originalIndex = rangeValues.length - 1 - reverseIndex;
              const cumulativeTop = rangeValues.slice().reverse().slice(0, reverseIndex).reduce((sum, val) => sum + val, 0) * 3.5;
              return (
                <Box
                  key={originalIndex}
                  sx={{
                    position: 'absolute',
                    top: `${cumulativeTop}px`,
                    left: 0,
                    right: 0,
                    height: `${value * 3.5}px`,
                    backgroundColor: rangeColors[originalIndex],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {value > 1 ? `${value}%` : ''}
                </Box>
              );
            })}
          </Box>
          
          {/* Range Labels and Values - Ordered from highest to lowest values */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5, ml: 2, minWidth: 280 }}>
            {biomarkerType === 'glucose' ? (
              <>
                {/* Very High - highest values */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[4], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very High <span style={{color: '#666', fontWeight: 'normal'}}>(&gt;{chartConfiguration.ranges?.high?.max || 250} mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[4]}% ({formatTime((patientData.statistics.timeVeryHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[3], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    High <span style={{color: '#666', fontWeight: 'normal'}}>({(chartConfiguration.ranges?.target?.max || 180) + 1}-{chartConfiguration.ranges?.high?.max || 250} mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[3]}% ({formatTime((patientData.statistics.timeHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[2], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Target Range <span style={{color: '#666', fontWeight: 'normal'}}>({chartConfiguration.ranges?.target?.min || 70}-{chartConfiguration.ranges?.target?.max || 180} mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[2]}% ({formatTime((patientData.statistics.timeTargetMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[1], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Low <span style={{color: '#666', fontWeight: 'normal'}}>({chartConfiguration.ranges?.veryLow?.max || 54}-{(chartConfiguration.ranges?.target?.min || 70) - 1} mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[1]}% ({formatTime((patientData.statistics.timeLowMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[0], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very Low <span style={{color: '#666', fontWeight: 'normal'}}>(&lt;{chartConfiguration.ranges?.veryLow?.max || 54} mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[0]}% ({formatTime((patientData.statistics.timeVeryLowMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                {/* Very High - highest values */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[4], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very High <span style={{color: '#666', fontWeight: 'normal'}}>(&gt;{chartConfiguration.ranges?.high?.max || 50} ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[4]}% ({formatTime((patientData.statistics.timeVeryHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[3], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    High <span style={{color: '#666', fontWeight: 'normal'}}>({(chartConfiguration.ranges?.normal?.max || 30) + 1}-{chartConfiguration.ranges?.high?.max || 50} ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[3]}% ({formatTime((patientData.statistics.timeHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[2], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Normal Range <span style={{color: '#666', fontWeight: 'normal'}}>({chartConfiguration.ranges?.normal?.min || 10}-{chartConfiguration.ranges?.normal?.max || 30} ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[2]}% ({formatTime((patientData.statistics.timeNormalMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[1], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Low <span style={{color: '#666', fontWeight: 'normal'}}>({chartConfiguration.ranges?.veryLow?.max || 5}-{(chartConfiguration.ranges?.normal?.min || 10) - 1} ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[1]}% ({formatTime((patientData.statistics.timeLowMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[0], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very Low <span style={{color: '#666', fontWeight: 'normal'}}>(&lt;{chartConfiguration.ranges?.veryLow?.max || 5} ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[0]}% ({formatTime((patientData.statistics.timeVeryLowMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </Grid>

  {/* GLUCOSE METRICS */}
  <Grid item xs={12} md={6}>
    <Card sx={{ height: 500, margin: '0 auto', width: '100%', maxWidth: 600 }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ 
          backgroundColor: '#333', 
          color: 'white', 
          p: 1.5, 
          mb: 3,
          fontSize: '16px',
          letterSpacing: '2px',
          textAlign: 'center',
          width: '100%'
        }}>
          {biomarkerType === 'glucose' ? 'GLUCOSE RANGES' : 'CORTISOL RANGES'}
        </Typography>
         
         {/* Header Row */}
         <Box sx={{ display: 'flex', mb: 2, pb: 1, borderBottom: '2px solid #333', width: '90%' }}>
           <Typography variant="body2" fontWeight="bold" sx={{ flex: 2 }}>
             {biomarkerType === 'glucose' ? 'Glucose Ranges' : 'Cortisol Ranges'}
           </Typography>
           <Typography variant="body2" fontWeight="bold" sx={{ flex: 1.5, textAlign: 'center' }}>
             Targets [% of Readings (Time/Day)]
           </Typography>
         </Box>
        
        {biomarkerType === 'glucose' ? (
          <>
            {/* Target Range Row */}
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Target Range {chartConfiguration.ranges?.target?.min || 70}–{chartConfiguration.ranges?.target?.max || 180} mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Target &gt;70% ({formatTime((patientData.statistics.timeTargetMinutes || 0) * 0.7)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below {chartConfiguration.ranges?.target?.min || 70} mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 4% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.04)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below {chartConfiguration.ranges?.veryLow?.max || 54} mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 1% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.01)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above {chartConfiguration.ranges?.target?.max || 180} mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 25% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.25)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above {chartConfiguration.ranges?.high?.max || 250} mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 5% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.05)})
              </Typography>
            </Box>
            
            {/* Clinical Note */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd', width: '90%' }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center' }}>
                Each 5% increase in time in range ({chartConfiguration.ranges?.target?.min || 70}-{chartConfiguration.ranges?.target?.max || 180} mg/dL) is clinically beneficial.
              </Typography>
            </Box>
          </>
        ) : (
          <>
            {/* Normal Range Row */}
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Normal Range {chartConfiguration.ranges?.normal?.min || 10}–{chartConfiguration.ranges?.normal?.max || 30} ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Target 60-80% ({formatTime((patientData.statistics.timeNormalMinutes || 0) * 0.7)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below {chartConfiguration.ranges?.normal?.min || 10} ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 10% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.10)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below {chartConfiguration.ranges?.veryLow?.max || 5} ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 2% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.02)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above {chartConfiguration.ranges?.normal?.max || 30} ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 20% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.20)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above {chartConfiguration.ranges?.high?.max || 50} ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 5% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.05)})
              </Typography>
            </Box>
            
            {/* Clinical Note */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd', width: '90%' }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center' }}>
                Maintaining cortisol in normal range ({chartConfiguration.ranges?.normal?.min || 10}-{chartConfiguration.ranges?.normal?.max || 30} ng/mL) is important for stress response and metabolic health.
              </Typography>
            </Box>
          </>
        )}
         

      </CardContent>
    </Card>
  </Grid>
</Grid>

      {/* Additional Metrics - Horizontal Section */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Card sx={{ width: '80%', maxWidth: 1200 }}>
          <CardContent sx={{ py: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ 
              backgroundColor: '#333', 
              color: 'white', 
              p: 1.5, 
              mb: 3,
              fontSize: '16px',
              letterSpacing: '2px',
              textAlign: 'center'
            }}>
              ADDITIONAL METRICS
            </Typography>
            
            <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
              {/* Date Range */}
              <Grid item xs={12} sm={6} md={2.4}>
                <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Date Range
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ fontSize: '1rem' }}>
                    {new Date(patientData.startAt).toLocaleDateString()} - {new Date(patientData.endAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Grid>
              
              {/* CGM Active Percentage */}
              <Grid item xs={12} sm={6} md={2.4}>
                <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    CGM Active
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {(() => {
                      // Calculate CGM Active percentage from wear time
                      const startDate = new Date(patientData.startAt);
                      const endDate = new Date(patientData.endAt);
                      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                      const totalPossibleMinutes = totalDays * 24 * 60;
                      const actualWearTimeMinutes = patientData.statistics.totalWearTimeMinutes || 0;
                      const cgmActivePercentage = Math.round((actualWearTimeMinutes / totalPossibleMinutes) * 100);
                      return `${cgmActivePercentage}%`;
                    })()}
                  </Typography>
                </Box>
              </Grid>
              
              {/* Average Value */}
              <Grid item xs={12} sm={6} md={2.4}>
                <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Average {biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'}
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    {patientData.statistics.average} {unit}
                  </Typography>
                </Box>
              </Grid>
              
              {/* A1C - Only for Glucose */}
              {biomarkerType === 'glucose' && (
                <Grid item xs={12} sm={6} md={2.4}>
                  <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Estimated A1C
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="secondary">
                      {patientData.statistics.a1c}%
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {/* GMI - Only for Glucose */}
              {biomarkerType === 'glucose' && ( 
                <Grid item xs={12} sm={6} md={2.4}>
                  <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      GMI
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="info.main">
                      {patientData.statistics.gmi}%
                    </Typography>
                  </Box>
                </Grid>
              )
              }
              
              {/* Coefficient of Variation */}
              <Grid item xs={12} sm={6} md={2.4}>
                <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Coefficient of Variation
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    {patientData.statistics.coefficientOfVariationPercentage}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {/* Clinical Note */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center', color: 'textSecondary' }}>
                {biomarkerType === 'glucose' 
                  ? 'Lower coefficient of variation indicates more stable glucose levels. A1C reflects average glucose over 2-3 months.'
                  : 'Coefficient of variation reflects cortisol variability. Normal cortisol follows circadian rhythm patterns.'
                }
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* AGP Chart */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Card sx={{ height: 500, width: '80%', maxWidth: 900 }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ 
              backgroundColor: '#333', 
              color: 'white', 
              p: 1.5, 
              mb: 3,
              fontSize: '16px',
              letterSpacing: '2px',
              textAlign: 'center'
            }}>
              {biomarkerType === 'glucose' ? 'AMBULATORY GLUCOSE PROFILE (AGP)' : 'AMBULATORY CORTISOL PROFILE (ACP)'}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3, textAlign: 'center' }}>
              {biomarkerType === 'glucose' 
                ? 'AGP is a summary of glucose values from the report period, with median (50%) and other percentiles shown as if they occurred in a single day.'
                : 'ACP is a summary of cortisol values from the report period, with median (50%) and other percentiles shown as if they occurred in a single day.'
              }
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ width: '100%', maxWidth: 800 }}>
                <Plot
                  data={agpData}
                  layout={{
                    ...agpLayout,
                    height: 350,
                    width: 800,
                    margin: { l: 60, r: 40, t: 40, b: 60 }
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: "100%", height: "100%" }}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Daily Glucose Profiles */}
      <Card sx={{ mt: 3, height: 300 }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ 
            backgroundColor: '#333', 
            color: 'white', 
            p: 1.5, 
            mb: 3,
            fontSize: '16px',
            letterSpacing: '2px',
            textAlign: 'center'
          }}>
            {biomarkerType === 'glucose' ? 'DAILY GLUCOSE PROFILES' : 'DAILY CORTISOL PROFILES'}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3, textAlign: 'center' }}>
            Each day represents a midnight-to-midnight period.
          </Typography>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography color="textSecondary" sx={{ fontSize: '16px', fontWeight: 500 }}>
                Daily {biomarkerType} profiles would show individual day overlays
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                (Implementation would require daily breakdown data)
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      </Box>
    </Container>
  );
}

export default AGPReport; 