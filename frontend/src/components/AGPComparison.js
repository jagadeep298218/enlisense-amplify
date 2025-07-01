/**
 * AGPComparison.js
 * 
 * PURPOSE: Side-by-side comparison of Ambulatory Glucose/Cortisol Profiles (AGP/ACP) between two patients
 * 
 * FEATURES:
 * - Dual AGP chart display with identical scaling for direct comparison
 * - Time-in-range percentage charts for both patients
 * - Statistics comparison table highlighting differences
 * - Biomarker type switching (glucose/cortisol) with proper range adaptations
 * - Responsive layout optimized for comparison viewing
 * 
 * DEPENDENCIES: 
 * - react-plotly.js for interactive charts
 * - Material-UI for consistent component styling
 * - React Router for navigation and URL parameter handling
 * 
 * ERROR HANDLING:
 * - [CRITICAL] API failures gracefully handled with user feedback
 * - [HIGH] Missing or invalid patient data shows appropriate fallbacks
 * - [MEDIUM] Chart rendering errors prevented with data validation
 * - [LOW] Network timeouts handled with retry suggestions
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import config from '../config';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CompareIcon from "@mui/icons-material/Compare";
import PersonIcon from "@mui/icons-material/Person";

function AGPComparison() {
  const { username1, username2, biomarkerType: paramBiomarkerType } = useParams();
  const navigate = useNavigate();
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [biomarkerType, setBiomarkerType] = useState(paramBiomarkerType || 'glucose');

  /**
   * MEMOIZED CALCULATION: Chart Configuration
   * PURPOSE: Pre-calculate shared chart properties to prevent re-renders
   * OPTIMIZATION: Expensive chart calculations only run when biomarkerType changes
   */
  const chartConfig = useMemo(() => {
    const unit = biomarkerType === 'glucose' ? 'mg/dL' : 'ng/mL';
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    
    return {
      unit,
      hourLabels,
      yAxisRange: biomarkerType === 'glucose' ? [0, 400] : [0, 100],
      targetRanges: biomarkerType === 'glucose' 
        ? { min: 70, max: 180 }
        : { min: 10, max: 30 }
    };
  }, [biomarkerType]);

  /**
   * EFFECT: Fetch Comparison Data
   * PURPOSE: Load AGP comparison data when users or biomarker type changes
   * 
   * ERROR HANDLING:
   * - [CRITICAL] Authentication token validation prevents unauthorized access
   * - [HIGH] HTTP error codes properly translated to user messages
   * - [MEDIUM] Network failures show retry instructions
   */
  useEffect(() => {
    const fetchComparisonData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Authentication required. Please log in again.");
        }

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
          `${config.API_URL}/agp-comparison/${username1}/${username2}/${biomarkerType}`, 
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || 
            `Server error (${response.status}). Please try again later.`
          );
        }

        const data = await response.json();
        
        console.log('=== API RESPONSE ===');
        console.log('Raw API response:', data);
        console.log('Patient1 data:', data.patient1);
        console.log('Patient2 data:', data.patient2);
        
        // Validate that we have data for both patients
        if (!data.patient1 && !data.patient2) {
          throw new Error("No data available for either patient");
        }

        setComparisonData(data);
      } catch (error) {
        console.error("Error fetching comparison data:", error);
        
        if (error.name === 'AbortError') {
          setError("Request timed out. Please check your connection and try again.");
        } else {
          setError(error.message);
        }
      } finally {
        setLoading(false);
      }
    };

    if (username1 && username2) {
      fetchComparisonData();
    } else {
      setError("Invalid user parameters");
      setLoading(false);
    }
  }, [username1, username2, biomarkerType]);

  /**
   * FUNCTION: createAGPChart
   * PURPOSE: Generate AGP percentile chart for individual patient data
   * PARAMETERS: 
   *   - patientData: Patient's processed AGP data with percentiles
   *   - title: Chart title for display
   * 
   * PROCESS:
   * 1. Validate patient data exists and has required percentiles
   * 2. Create layered percentile traces with proper fill areas
   * 3. Apply consistent styling and hover templates
   * 4. Return configured Plotly component
   * 
   * ERROR HANDLING:
   * - [HIGH] Missing percentile data returns null (graceful degradation)
   * - [MEDIUM] Invalid data structures handled with fallbacks
   * - [LOW] Chart rendering errors caught by parent error boundary
   */
  const createAGPChart = useCallback((patientData, title) => {
    // Validate input data
    if (!patientData || patientData.error) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Alert severity="warning">
            {patientData?.error || "No chart data available"}
          </Alert>
        </Box>
      );
    }

    const percentiles = patientData.data?.percentiles || patientData.percentages || patientData.percentiles;
    if (!percentiles) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Alert severity="error">
            Missing percentile data for chart generation
          </Alert>
        </Box>
      );
    }

    const { hourLabels, unit, yAxisRange } = chartConfig;

    // Create percentile traces with proper layering
    const agpData = [
      {
        x: hourLabels,
        y: percentiles.percentile_95,
        name: "95th Percentile",
        line: { color: "#e5e7eb", width: 1 },
        mode: "lines",
        fill: "tonexty",
        fillcolor: "rgba(229, 231, 235, 0.2)",
        hovertemplate: `<b>95th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
      },
      {
        x: hourLabels,
        y: percentiles.percentile_75,
        name: "75th Percentile",
        line: { color: "#9ca3af", width: 1 },
        mode: "lines",
        fill: "tonexty",
        fillcolor: "rgba(156, 163, 175, 0.3)",
        hovertemplate: `<b>75th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
      },
      {
        x: hourLabels,
        y: percentiles.percentile_50,
        name: "Median (50th)",
        line: { color: "#1f2937", width: 3 },
        mode: "lines",
        hovertemplate: `<b>Median</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
      },
      {
        x: hourLabels,
        y: percentiles.percentile_25,
        name: "25th Percentile",
        line: { color: "#9ca3af", width: 1 },
        mode: "lines",
        fill: "tonexty",
        fillcolor: "rgba(156, 163, 175, 0.3)",
        hovertemplate: `<b>25th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
      },
      {
        x: hourLabels,
        y: percentiles.percentile_5,
        name: "5th Percentile",
        line: { color: "#e5e7eb", width: 1 },
        mode: "lines",
        fill: "tonexty",
        fillcolor: "rgba(229, 231, 235, 0.2)",
        hovertemplate: `<b>5th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
      },
    ];

    const layout = {
      title: {
        text: title,
        font: { size: 16, family: "Arial" },
      },
      xaxis: {
        title: {
          text: "Time of Day",
          font: { size: 12 }
        },
        tickmode: "array",
        tickvals: [0, 3, 6, 9, 12, 15, 18, 21],
        ticktext: ["12 AM", "3 AM", "6 AM", "9 AM", "12 PM", "3 PM", "6 PM", "9 PM"],
        tickfont: { size: 10 }
      },
      yaxis: {
        title: {
          text: `${biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'} (${unit})`,
          font: { size: 12 }
        },
        range: yAxisRange,
        tickfont: { size: 10 }
      },
      margin: { l: 60, r: 40, t: 40, b: 60 },
      height: 500,
      showlegend: false,
      plot_bgcolor: "white",
      paper_bgcolor: "white",
    };

    return <Plot data={agpData} layout={layout} style={{ width: "100%", height: "100%" }} config={{ responsive: true }} />;
  }, [biomarkerType, chartConfig]);

  /**
   * FUNCTION: createTimeInRangeChart
   * PURPOSE: Generate time-in-range bar chart showing percentage distribution
   * PARAMETERS:
   *   - patientData: Patient statistics containing range percentages
   *   - title: Chart title for display
   * 
   * PROCESS:
   * 1. Extract and validate statistics data
   * 2. Calculate range percentages with safe math operations
   * 3. Create color-coded bar chart with proper labels
   * 4. Apply biomarker-specific ranges and colors
   * 
   * ERROR HANDLING:
   * - [HIGH] Missing statistics handled with zero values
   * - [MEDIUM] Invalid percentage calculations default to 0
   * - [LOW] Chart rendering protected with data validation
   */
  const createTimeInRangeChart = useCallback((patientData, title) => {
    console.log('=== TIME IN RANGE DEBUG ===');
    console.log('Patient data received:', patientData);
    console.log('Patient data keys:', patientData ? Object.keys(patientData) : 'null');
    if (patientData?.data) {
      console.log('Patient.data keys:', Object.keys(patientData.data));
      console.log('Patient.data.statistics:', patientData.data.statistics);
    }

    if (!patientData || patientData.error) {
      console.log('No patient data or error:', patientData?.error);
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Alert severity="warning">
            {patientData?.error || "No time-in-range data available"}
          </Alert>
        </Box>
      );
    }

    const stats = patientData.data?.statistics || patientData.statistics?.statistics || patientData.statistics;
    console.log('Extracted stats:', stats);
    if (!stats) {
      console.log('No stats found');
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Alert severity="error">
            Missing statistics for time-in-range calculation
          </Alert>
        </Box>
      );
    }

    let rangeValues, rangeLabels, rangeColors;

    if (biomarkerType === 'glucose') {
      // Safe percentage extraction with fallbacks
      const below54 = stats.percentBelow54 || 0;
      const between54And69 = Math.max(0, (stats.percentBelow70 || 0) - below54);
      const targetRange = stats.percentBetween70And180 || 0;
      const between181And250 = Math.max(0, (stats.percentAbove180 || 0) - (stats.percentAbove250 || 0));
      const above250 = stats.percentAbove250 || 0;
      
      rangeValues = [below54, between54And69, targetRange, between181And250, above250];
      rangeLabels = ["Very Low<br><54", "Low<br>54-69", "Target<br>70-180", "High<br>181-250", "Very High<br>>250"];
      rangeColors = ["#dc2626", "#f59e0b", "#10b981", "#f59e0b", "#dc2626"];
    } else {
      // Cortisol ranges - using backend property names exactly as they are calculated
      // Backend calculates: percentBelow5 (veryLow), percentBelow10 (low), percentBetween10And30 (normal), percentAbove30 (high), percentAbove50 (veryHigh)
      // But the actual ranges used are: <2, 2-5, 5-15, 15-20, >20
      const veryLow = stats.percentBelow5 || 0;  // <2 (backend uses veryLowMax=2 but property is percentBelow5)
      const low = Math.max(0, (stats.percentBelow10 || 0) - (stats.percentBelow5 || 0)); // 2-5
      const normal = stats.percentBetween10And30 || 0;  // 5-15 (backend uses normalMin=5, normalMax=15 but property is percentBetween10And30)
      const high = Math.max(0, (stats.percentAbove30 || 0) - (stats.percentAbove50 || 0)); // 15-20
      const veryHigh = stats.percentAbove50 || 0; // >20
      
      rangeValues = [veryLow, low, normal, high, veryHigh];
      rangeLabels = ["Very Low<br><2", "Low<br>2-5", "Normal<br>5-15", "High<br>15-20", "Very High<br>>20"];
      rangeColors = ["#3b82f6", "#60a5fa", "#10b981", "#f59e0b", "#dc2626"];
    }

    // If all values are 0, show a message instead of an empty chart
    const totalValues = rangeValues.reduce((sum, val) => sum + val, 0);
    if (totalValues === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Alert severity="info">
            No time-in-range data available for this patient
          </Alert>
        </Box>
      );
    }

    const timeInRangeData = [
      {
        x: rangeLabels,
        y: rangeValues,
        type: "bar",
        marker: {
          color: rangeColors,
          line: { color: "#333", width: 1 }
        },
        text: rangeValues.map(val => `${val.toFixed(1)}%`),
        textposition: "auto",
        textfont: { color: "white", size: 12, family: "Arial Black" },
        hovertemplate: "<b>%{x}</b><br>%{y:.1f}%<extra></extra>",
      },
    ];

    const layout = {
      title: {
        text: title,
        font: { size: 14, family: "Arial" },
      },
      xaxis: {
        title: {
          text: `${biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'} Range (${chartConfig.unit})`,
          font: { size: 11 }
        },
        tickfont: { size: 10 }
      },
      yaxis: {
        title: {
          text: "Percentage (%)",
          font: { size: 11 }
        },
        range: [0, 100],
        tickfont: { size: 10 }
      },
      margin: { l: 60, r: 30, t: 60, b: 80 },
      height: 300,
      showlegend: false,
      plot_bgcolor: "white",
      paper_bgcolor: "white",
    };

    return <Plot data={timeInRangeData} layout={layout} style={{ width: "100%", height: "100%" }} config={{ responsive: true }} />;
  }, [biomarkerType, chartConfig]);

  /**
   * FUNCTION: handleBiomarkerChange
   * PURPOSE: Update biomarker type and navigate to new comparison URL
   * 
   * ERROR HANDLING:
   * - [LOW] Navigation failures handled by router error boundary
   */
  const handleBiomarkerChange = useCallback((event, newType) => {
    if (newType && newType !== biomarkerType) {
      setBiomarkerType(newType);
      navigate(`/agp-comparison/${username1}/${username2}/${newType}`, { replace: true });
    }
  }, [biomarkerType, navigate, username1, username2]);

  /**
   * FUNCTION: createStatisticsComparison
   * PURPOSE: Generate comprehensive statistics comparison table
   * PARAMETERS:
   *   - patient1Data: Patient 1's statistics data
   *   - patient2Data: Patient 2's statistics data
   * 
   * PROCESS:
   * 1. Extract statistics from both patients
   * 2. Create comparison rows with differences highlighted
   * 3. Handle biomarker-specific metrics
   * 4. Format values appropriately for display
   */
  const createStatisticsComparison = useCallback((patient1Data, patient2Data) => {
    const stats1 = patient1Data?.data?.statistics || {};
    const stats2 = patient2Data?.data?.statistics || {};
    
    const unit = biomarkerType === 'glucose' ? 'mg/dL' : 'ng/mL';
    
    const formatValue = (value, isPercentage = false, decimals = 1) => {
      if (value === null || value === undefined || isNaN(value)) return 'N/A';
      if (isPercentage) return `${value.toFixed(decimals)}%`;
      return `${value.toFixed(decimals)} ${unit}`;
    };
    
    const calculateDifference = (val1, val2, isPercentage = false) => {
      if (!val1 || !val2 || isNaN(val1) || isNaN(val2)) return 'N/A';
      const diff = val2 - val1;
      const prefix = diff > 0 ? '+' : '';
      if (isPercentage) return `${prefix}${diff.toFixed(1)}%`;
      return `${prefix}${diff.toFixed(1)} ${unit}`;
    };

    const getDifferenceColor = (val1, val2, lowerIsBetter = false) => {
      if (!val1 || !val2 || isNaN(val1) || isNaN(val2)) return 'text.primary';
      const diff = val2 - val1;
      if (Math.abs(diff) < 0.01) return 'text.primary';
      
      if (lowerIsBetter) {
        return diff < 0 ? 'success.main' : 'error.main';
      } else {
        return diff > 0 ? 'success.main' : 'error.main';
      }
    };

    let comparisonRows = [];

    if (biomarkerType === 'glucose') {
      comparisonRows = [
        {
          metric: 'Average Glucose',
          patient1: formatValue(stats1.average),
          patient2: formatValue(stats2.average),
          difference: calculateDifference(stats1.average, stats2.average),
          diffColor: getDifferenceColor(stats1.average, stats2.average, false)
        },
        {
          metric: 'Standard Deviation',
          patient1: formatValue(stats1.standardDeviation),
          patient2: formatValue(stats2.standardDeviation),
          difference: calculateDifference(stats1.standardDeviation, stats2.standardDeviation),
          diffColor: getDifferenceColor(stats1.standardDeviation, stats2.standardDeviation, true)
        },
        {
          metric: 'Time in Range (70-180)',
          patient1: formatValue(stats1.percentBetween70And180, true),
          patient2: formatValue(stats2.percentBetween70And180, true),
          difference: calculateDifference(stats1.percentBetween70And180, stats2.percentBetween70And180, true),
          diffColor: getDifferenceColor(stats1.percentBetween70And180, stats2.percentBetween70And180, false)
        },
        {
          metric: 'Time Below 70',
          patient1: formatValue(stats1.percentBelow70, true),
          patient2: formatValue(stats2.percentBelow70, true),
          difference: calculateDifference(stats1.percentBelow70, stats2.percentBelow70, true),
          diffColor: getDifferenceColor(stats1.percentBelow70, stats2.percentBelow70, true)
        },
        {
          metric: 'Time Above 180',
          patient1: formatValue(stats1.percentAbove180, true),
          patient2: formatValue(stats2.percentAbove180, true),
          difference: calculateDifference(stats1.percentAbove180, stats2.percentAbove180, true),
          diffColor: getDifferenceColor(stats1.percentAbove180, stats2.percentAbove180, true)
        },
        {
          metric: 'Time Above 250',
          patient1: formatValue(stats1.percentAbove250, true),
          patient2: formatValue(stats2.percentAbove250, true),
          difference: calculateDifference(stats1.percentAbove250, stats2.percentAbove250, true),
          diffColor: getDifferenceColor(stats1.percentAbove250, stats2.percentAbove250, true)
        },
        {
          metric: 'Coefficient of Variation',
          patient1: formatValue(stats1.coefficientOfVariationPercentage, true),
          patient2: formatValue(stats2.coefficientOfVariationPercentage, true),
          difference: calculateDifference(stats1.coefficientOfVariationPercentage, stats2.coefficientOfVariationPercentage, true),
          diffColor: getDifferenceColor(stats1.coefficientOfVariationPercentage, stats2.coefficientOfVariationPercentage, true)
        }
      ];
    } else {
      // Cortisol metrics
      comparisonRows = [
        {
          metric: 'Average Cortisol',
          patient1: formatValue(stats1.average),
          patient2: formatValue(stats2.average),
          difference: calculateDifference(stats1.average, stats2.average),
          diffColor: getDifferenceColor(stats1.average, stats2.average, false)
        },
        {
          metric: 'Standard Deviation',
          patient1: formatValue(stats1.standardDeviation),
          patient2: formatValue(stats2.standardDeviation),
          difference: calculateDifference(stats1.standardDeviation, stats2.standardDeviation),
          diffColor: getDifferenceColor(stats1.standardDeviation, stats2.standardDeviation, false)
        },
        {
          metric: 'Normal Range (5-15)',
          patient1: formatValue(stats1.percentBetween10And30, true),
          patient2: formatValue(stats2.percentBetween10And30, true),
          difference: calculateDifference(stats1.percentBetween10And30, stats2.percentBetween10And30, true),
          diffColor: getDifferenceColor(stats1.percentBetween10And30, stats2.percentBetween10And30, false)
        },
        {
          metric: 'Below Normal Range',
          patient1: formatValue(stats1.percentBelow10, true),
          patient2: formatValue(stats2.percentBelow10, true),
          difference: calculateDifference(stats1.percentBelow10, stats2.percentBelow10, true),
          diffColor: getDifferenceColor(stats1.percentBelow10, stats2.percentBelow10, true)
        },
        {
          metric: 'Above Normal Range',
          patient1: formatValue(stats1.percentAbove30, true),
          patient2: formatValue(stats2.percentAbove30, true),
          difference: calculateDifference(stats1.percentAbove30, stats2.percentAbove30, true),
          diffColor: getDifferenceColor(stats1.percentAbove30, stats2.percentAbove30, true)
        }
      ];
    }

    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Metric</strong></TableCell>
              <TableCell align="center"><strong>{username1}</strong></TableCell>
              <TableCell align="center"><strong>{username2}</strong></TableCell>
              <TableCell align="center"><strong>Difference</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comparisonRows.map((row, index) => (
              <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                <TableCell component="th" scope="row">
                  {row.metric}
                </TableCell>
                <TableCell align="center">{row.patient1}</TableCell>
                <TableCell align="center">{row.patient2}</TableCell>
                <TableCell align="center" sx={{ color: row.diffColor, fontWeight: 'medium' }}>
                  {row.difference}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }, [biomarkerType, username1, username2]);

  // Loading state
  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading comparison data...</Typography>
        </Box>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            variant="outlined"
          >
            Back
          </Button>
        </Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Failed to Load Comparison</Typography>
          <Typography>{error}</Typography>
          <Box sx={{ mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={() => window.location.reload()}
              size="small"
            >
              Retry
            </Button>
          </Box>
        </Alert>
      </Container>
    );
  }

  // No data state
  if (!comparisonData) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="warning">
          No comparison data available for the selected patients.
        </Alert>
      </Container>
    );
  }

  const { patient1, patient2 } = comparisonData;

  console.log('=== AGP COMPARISON RENDER ===');
  console.log('Comparison data:', comparisonData);
  console.log('Patient 1:', patient1);
  console.log('Patient 2:', patient2);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header Controls */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          variant="outlined"
        >
          Back
        </Button>
        
        <ToggleButtonGroup
          value={biomarkerType}
          exclusive
          onChange={handleBiomarkerChange}
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
      </Box>

      {/* Comparison Title */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareIcon color="primary" />
          AGP Comparison: {username1} vs {username2}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'} Profile Comparison
        </Typography>
      </Paper>

      {/* AGP Charts Comparison */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%', overflow: 'hidden' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="primary" />
                <Typography variant="h6">{username1}</Typography>
                <Chip label="Patient 1" size="small" color="primary" />
              </Box>
              <Box sx={{ width: '100%', minHeight: 500, overflow: 'auto' }}>
                {createAGPChart(patient1, `${username1} - AGP`)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%', overflow: 'hidden' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="secondary" />
                <Typography variant="h6">{username2}</Typography>
                <Chip label="Patient 2" size="small" color="secondary" />
              </Box>
              <Box sx={{ width: '100%', minHeight: 500, overflow: 'auto' }}>
                {createAGPChart(patient2, `${username2} - AGP`)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Time in Range Comparison */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="primary" />
                <Typography variant="h6">{username1} - Time in Range</Typography>
                <Chip label="Patient 1" size="small" color="primary" />
              </Box>
              <Box sx={{ width: '100%', minHeight: 350 }}>
                {createTimeInRangeChart(patient1, `${username1} - Time in Range`)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="secondary" />
                <Typography variant="h6">{username2} - Time in Range</Typography>
                <Chip label="Patient 2" size="small" color="secondary" />
              </Box>
              <Box sx={{ width: '100%', minHeight: 350 }}>
                {createTimeInRangeChart(patient2, `${username2} - Time in Range`)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Statistics Comparison Table */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Statistics Comparison
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Side-by-side comparison of key {biomarkerType === 'glucose' ? 'glucose' : 'cortisol'} metrics. 
          Green indicates improvement, red indicates deterioration compared to Patient 1.
        </Typography>
        {createStatisticsComparison(patient1, patient2)}
      </Paper>
    </Container>
  );
}

export default AGPComparison; 