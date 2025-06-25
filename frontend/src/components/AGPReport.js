import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
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
  Divider,
  ToggleButton,
    ToggleButtonGroup
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const reportRef = useRef();

  // CSV Download function for additional metrics
  const downloadCSV = () => {
    try {
      // Calculate CGM Active percentage from wear time using actual date range
      const startDate = new Date(patientData.startAt);
      const endDate = new Date(patientData.endAt);
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const totalPossibleMinutes = totalDays * 24 * 60;
      const actualWearTimeMinutes = patientData.statistics.totalWearTimeMinutes || 0;
      const cgmActivePercentage = Math.round((actualWearTimeMinutes / totalPossibleMinutes) * 100);
      
      // Calculate actual date range from data
      const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      
      // Create metrics data array
      const metrics = [
        ['Metric', 'Value'],
        ['Date Range', dateRange],
        ['CGM Active', `${cgmActivePercentage}%`],
        [`Average ${biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'}`, `${patientData.statistics.average} ${biomarkerType === 'glucose' ? 'mg/dL' : 'ng/mL'}`],
        ['Coefficient of Variation', `${patientData.statistics.coefficientOfVariationPercentage}%`]
      ];
      
      // Add glucose-specific metrics
      if (biomarkerType === 'glucose') {
        metrics.push(['Estimated A1C', `${patientData.statistics.a1c}%`]);
        metrics.push(['GMI', `${patientData.statistics.gmi}%`]);
      }
      
      // Convert to CSV format
      const csvContent = metrics.map(row => row.join(',')).join('\n');
      
      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with patient name and date
      const patientName = patientData?.patientInfo?.name || username || 'Patient';
      const date = new Date().toISOString().split('T')[0];
      const biomarkerTypeCapitalized = biomarkerType.charAt(0).toUpperCase() + biomarkerType.slice(1);
      const filename = `${patientName}_${biomarkerTypeCapitalized}_AGP_Additional_Metrics_${date}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Error generating CSV. Please try again.');
    }
  };

  // PDF Download function - defined early to avoid hoisting issues
  const downloadPDF = async () => {
    try {
      setIsDownloading(true);
      
      // Get the report container element
      const element = reportRef.current;
      if (!element) {
        throw new Error('Report element not found');
      }

      // Hide interactive elements before capturing
      const elementsToHide = element.querySelectorAll('.pdf-hide');
      elementsToHide.forEach(el => {
        el.style.display = 'none';
      });

      // Configure html2canvas options for better quality
      const canvas = await html2canvas(element, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });

      // Restore hidden elements after capturing
      elementsToHide.forEach(el => {
        el.style.display = '';
      });

      // Calculate PDF dimensions
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // A4 dimensions in mm
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Calculate image dimensions to fit A4
      const imgWidth = pdfWidth - 20; // 10mm margins on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // If the content is too tall for one page, we'll fit it to page height
      const finalHeight = imgHeight > (pdfHeight - 20) ? (pdfHeight - 20) : imgHeight;
      const finalWidth = imgHeight > (pdfHeight - 20) ? (canvas.width * finalHeight) / canvas.height : imgWidth;
      
      // Center the image on the page
      const x = (pdfWidth - finalWidth) / 2;
      const y = 10; // 10mm top margin
      
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      
      // Generate filename with patient name and date
      const patientName = patientData?.patientInfo?.name || username || 'Patient';
      const date = new Date().toISOString().split('T')[0];
      const biomarkerTypeCapitalized = biomarkerType.charAt(0).toUpperCase() + biomarkerType.slice(1);
      const filename = `${patientName}_${biomarkerTypeCapitalized}_AGP_Report_${date}.pdf`;
      
      pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const fetchAGPData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found");
        }

        // Fetch AGP data and applicable ranges based on personal information in parallel
        const [agpResponse, applicableRangesResponse] = await Promise.all([
          fetch(biomarkerType === 'glucose' 
            ? `http://localhost:3000/user-glucose-agp/${username}`
            : `http://localhost:3000/user-cortisol-agp/${username}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`http://localhost:3000/user-applicable-ranges/${username}/${biomarkerType}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null) // Don't fail if ranges can't be fetched
        ]);

        if (!agpResponse.ok) {
          throw new Error(`HTTP error! status: ${agpResponse.status}`);
        }

        const agpData = await agpResponse.json();
        setPatientData(agpData);

        // Set applicable ranges if available
        if (applicableRangesResponse && applicableRangesResponse.ok) {
          const rangesData = await applicableRangesResponse.json();
          setApplicableRanges(rangesData);
          
          if (!rangesData.useDefault && rangesData.ranges) {
            setCustomRanges(rangesData.ranges);
            setRangeMessage(rangesData.message || '');
          } else {
            setCustomRanges(null);
            setRangeMessage(rangesData.message || '');
          }
        }

      } catch (error) {
        console.error("Error fetching AGP data:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchAGPData();
    }
  }, [username, biomarkerType]);

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

  // Debug logging
  console.log("Patient data statistics:", patientData.statistics);
  console.log("Custom ranges being used:", customRanges);
  console.log("Applicable ranges data:", applicableRanges);
  console.log("Embed mode:", embedMode);
  
  // Get range thresholds (custom or default)
  const getRangeThresholds = () => {
    if (customRanges) {
      return customRanges;
    }
    
    // Default ranges
    if (biomarkerType === 'glucose') {
      return {
        veryLow: { min: 0, max: 54 },
        low: { min: 54, max: 70 },
        target: { min: 70, max: 180 },
        high: { min: 180, max: 250 },
        veryHigh: { min: 250, max: 400 }
      };
    } else {
      return {
        veryLow: { min: 0, max: 5 },
        low: { min: 5, max: 10 },
        normal: { min: 10, max: 30 },
        high: { min: 30, max: 50 },
        veryHigh: { min: 50, max: 100 }
      };
    }
  };

  // Calculate time in range values using custom or default thresholds
  const ranges = getRangeThresholds();
  let rangeValues, rangeLabels, rangeColors, unit;
  
  if (biomarkerType === 'glucose') {
    // Calculate percentages based on custom thresholds
    const veryLowThreshold = ranges?.veryLow?.max || 54;
    const lowThreshold = ranges?.low?.max || 70;
    const targetMin = ranges?.target?.min || 70;
    const targetMax = ranges?.target?.max || 180;
    const highThreshold = ranges?.high?.max || 250;
    
    // Backend now calculates statistics with custom ranges, so use them directly
    // Note: The backend variable names like "percentBelow54" are misleading - they're actually 
    // calculated using the custom thresholds (e.g., percentBelow54 uses veryLowThreshold, not fixed 54)
    const veryLowPercent = patientData.statistics.percentBelow54 || 0;
    const lowPercent = Math.max(0, (patientData.statistics.percentBelow70 || 0) - veryLowPercent);
    const targetPercent = patientData.statistics.percentBetween70And180 || 0;
    const highPercent = Math.max(0, (patientData.statistics.percentAbove180 || 0) - (patientData.statistics.percentAbove250 || 0));
    const veryHighPercent = patientData.statistics.percentAbove250 || 0;
    
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
    // Cortisol ranges (0-20 ng/mL scale)
    const veryLowThreshold = ranges?.veryLow?.max || 2;
    const lowThreshold = ranges?.low?.max || 5;
    const normalMin = ranges?.normal?.min || 5;
    const normalMax = ranges?.normal?.max || 15;
    const highThreshold = ranges?.high?.max || 20;
    
    // Backend calculates cortisol statistics with custom ranges
    const veryLowPercent = patientData.statistics.percentBelow5 || 0;
    const lowPercent = Math.max(0, (patientData.statistics.percentBelow10 || 0) - veryLowPercent);
    const normalPercent = patientData.statistics.percentBetween10And30 || 0;
    const highPercent = Math.max(0, (patientData.statistics.percentAbove30 || 0) - (patientData.statistics.percentAbove50 || 0));
    const veryHighPercent = patientData.statistics.percentAbove50 || 0;
    
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
  
  console.log("Time in range values:", rangeValues);
  console.log("Custom range thresholds used:", biomarkerType === 'glucose' ? {
    veryLow: ranges?.veryLow?.max || 54,
    low: ranges?.low?.max || 70, 
    targetMin: ranges?.target?.min || 70,
    targetMax: ranges?.target?.max || 180,
    high: ranges?.high?.max || 250
  } : {
    veryLow: ranges?.veryLow?.max || 2,
    low: ranges?.low?.max || 5,
    normalMin: ranges?.normal?.min || 5, 
    normalMax: ranges?.normal?.max || 15,
    high: ranges?.high?.max || 20
  });
  console.log("Backend statistics (calculated with custom ranges):", {
    percentBelow54: patientData.statistics.percentBelow54,
    percentBelow70: patientData.statistics.percentBelow70,
    percentBetween70And180: patientData.statistics.percentBetween70And180,
    percentAbove180: patientData.statistics.percentAbove180,
    percentAbove250: patientData.statistics.percentAbove250
  });
  console.log("Actual wear time:", {
    totalWearTimeHours: patientData.statistics.totalWearTimeHours,
    totalWearTimeMinutes: patientData.statistics.totalWearTimeMinutes,
    timeInTargetMinutes: biomarkerType === 'glucose' ? patientData.statistics.timeTargetMinutes : patientData.statistics.timeNormalMinutes
  });
  console.log("Chart should now accurately reflect custom ranges!");
  
  // Helper function to convert minutes to hours and minutes display
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  // Time in Range Bar Chart Data for Plotly
  const timeInRangeData = [
    {
      x: rangeLabels,
      y: rangeValues,
      type: "bar",
      marker: {
        color: rangeColors,
        line: { color: "#333", width: 1 }
      },
      text: rangeValues.map(val => `${val}%`),
      textposition: "auto",
      textfont: { color: "white", size: 14, family: "Arial Black" },
      hovertemplate: "<b>%{x}</b><br>%{y}%<extra></extra>",
    },
  ];

  const timeInRangeLayout = {
    title: {
      text: biomarkerType === 'glucose' 
        ? "Time In Ranges<br><sub>Goals for Type 1 and Type 2 Diabetes</sub>"
        : "Time In Ranges<br><sub>Cortisol Level Distribution</sub>",
      font: { size: 18, family: "Arial" },
    },
    xaxis: {
      title: {
        text: `${biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'} Range (${unit})`,
        font: { size: 14 }
      },
      tickfont: { size: 12 }
    },
    yaxis: {
      title: {
        text: "Percentage (%)",
        font: { size: 14 }
      },
      range: [0, 100],
      tickfont: { size: 12 }
    },
    margin: { l: 80, r: 40, t: 100, b: 80 },
    height: 400,
    width: 600,
    showlegend: false,
    bargap: 0.4,
    plot_bgcolor: "white",
    paper_bgcolor: "white",
  };

  // AGP Chart Data for Plotly
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  const agpData = [
    {
      x: hourLabels,
      y: patientData.percentages.percentile_95,
      name: "95th Percentile",
      line: { color: "#e5e7eb", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(229, 231, 235, 0.2)",
      hovertemplate: `<b>95th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: patientData.percentages.percentile_75,
      name: "75th Percentile",
      line: { color: "#9ca3af", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(156, 163, 175, 0.3)",
      hovertemplate: `<b>75th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: patientData.percentages.percentile_50,
      name: "Median (50th)",
      line: { color: "#374151", width: 3 },
      mode: "lines",
      hovertemplate: `<b>Median</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: patientData.percentages.percentile_25,
      name: "25th Percentile",
      line: { color: "#9ca3af", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(156, 163, 175, 0.3)",
      hovertemplate: `<b>25th Percentile</b><br>%{x}: %{y:.${biomarkerType === 'glucose' ? '0' : '3'}f} ${unit}<extra></extra>`,
    },
    {
      x: hourLabels,
      y: patientData.percentages.percentile_5,
      name: "5th Percentile",
      line: { color: "#e5e7eb", width: 1 },
      mode: "lines",
      fill: "tonexty",
      fillcolor: "rgba(229, 231, 235, 0.2)",
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
        <Box sx={{ mb: 4 }}>
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
            >
              {isDownloading ? 'Generating PDF...' : 'Download PDF'}
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={downloadCSV}
              variant="outlined"
              color="secondary"
            >
              Download CSV
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h4" component="h1" fontWeight="bold">
              {biomarkerType === 'glucose' ? 'AGP Report: Continuous Glucose Monitoring' : 'ACP Report: Continuous Cortisol Monitoring'}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                className="pdf-hide"
              >
                <ToggleButton value="glucose" aria-label="glucose">
                  Glucose
                </ToggleButton>
                <ToggleButton value="cortisol" aria-label="cortisol">
                  Cortisol
                </ToggleButton>
              </ToggleButtonGroup>
              
              {/* Auto-detected conditions display */}
              {applicableRanges && !applicableRanges.useDefault && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: 'info.main', color: 'white', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    Auto-detected: {applicableRanges.configsUsed?.join(', ') || 'Custom ranges'}
                  </Typography>
                </Box>
              )}
            </Box>
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
        </Box>
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
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
          </Button>
          
          {/* Download CSV Button for embed mode */}
          <Button
            startIcon={<DownloadIcon />}
            onClick={downloadCSV}
            variant="outlined"
            color="secondary"
            size="small"
          >
            Download CSV
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
                    Very High <span style={{color: '#666', fontWeight: 'normal'}}>(&gt;250 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[4]}% ({formatTime((patientData.statistics.timeVeryHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[3], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    High <span style={{color: '#666', fontWeight: 'normal'}}>(181-250 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[3]}% ({formatTime((patientData.statistics.timeHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[2], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Target Range <span style={{color: '#666', fontWeight: 'normal'}}>(70-180 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[2]}% ({formatTime((patientData.statistics.timeTargetMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[1], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Low <span style={{color: '#666', fontWeight: 'normal'}}>(54-69 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[1]}% ({formatTime((patientData.statistics.timeLowMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[0], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very Low <span style={{color: '#666', fontWeight: 'normal'}}>(&lt;54 mg/dL)</span>
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
                    Very High <span style={{color: '#666', fontWeight: 'normal'}}>(&gt;20 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[4]}% ({formatTime((patientData.statistics.timeVeryHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[3], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    High <span style={{color: '#666', fontWeight: 'normal'}}>(15-20 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[3]}% ({formatTime((patientData.statistics.timeHighMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[2], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Normal Range <span style={{color: '#666', fontWeight: 'normal'}}>(5-15 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[2]}% ({formatTime((patientData.statistics.timeNormalMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[1], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Low <span style={{color: '#666', fontWeight: 'normal'}}>(2-5 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[1]}% ({formatTime((patientData.statistics.timeLowMinutes || 0))})
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[0], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very Low <span style={{color: '#666', fontWeight: 'normal'}}>(&lt;2 ng/mL)</span>
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
                Target Range 70–180 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Target &gt;70% ({formatTime((patientData.statistics.timeTargetMinutes || 0) * 0.7)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 70 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 4% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.04)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 54 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 1% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.01)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 180 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 25% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.25)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 250 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 5% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.05)})
              </Typography>
            </Box>
            
            {/* Clinical Note */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd', width: '90%' }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center' }}>
                Each 5% increase in time in range (70-180 mg/dL) is clinically beneficial.
              </Typography>
            </Box>
          </>
        ) : (
          <>
            {/* Normal Range Row */}
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Normal Range 5–15 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Target 60-80% ({formatTime((patientData.statistics.timeNormalMinutes || 0) * 0.7)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 5 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 10% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.10)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 2 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 2% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.02)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 15 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 20% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.20)})
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 20 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 5% ({formatTime((patientData.statistics.totalWearTimeMinutes || 0) * 0.05)})
              </Typography>
            </Box>
            
            {/* Clinical Note */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd', width: '90%' }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center' }}>
                Maintaining cortisol in normal range (5-15 ng/mL) is important for stress response and metabolic health.
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