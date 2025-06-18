import React, { useState, useEffect } from "react";
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

function AGPReport() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [biomarkerType, setBiomarkerType] = useState('glucose');

  useEffect(() => {
    const fetchAGPData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found");
        }

        const endpoint = biomarkerType === 'glucose' 
          ? `http://localhost:3000/user-glucose-agp/${username}`
          : `http://localhost:3000/user-cortisol-agp/${username}`;

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setPatientData(data);
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
  
  // Calculate time in range values based on biomarker type
  let rangeValues, rangeLabels, rangeColors, unit;
  
  if (biomarkerType === 'glucose') {
    const below54 = patientData.statistics.percentBelow54 || 0;
    const between54And69 = Math.max(0, (patientData.statistics.percentBelow70 || 0) - below54);
    const targetRange = patientData.statistics.percentBetween70And180 || 0;
    const between181And250 = Math.max(0, (patientData.statistics.percentAbove180 || 0) - (patientData.statistics.percentAbove250 || 0));
    const above250 = patientData.statistics.percentAbove250 || 0;
    
    rangeValues = [below54, between54And69, targetRange, between181And250, above250];
    rangeLabels = ["Very Low<br><54", "Low<br>54-69", "Target<br>70-180", "High<br>181-250", "Very High<br>>250"];
    rangeColors = ["#dc2626", "#f59e0b", "#10b981", "#f59e0b", "#dc2626"];
    unit = "mg/dL";
  } else {
    const below5 = patientData.statistics.percentBelow5 || 0;
    const between5And10 = Math.max(0, (patientData.statistics.percentBelow10 || 0) - below5);
    const targetRange = patientData.statistics.percentBetween10And30 || 0;
    const between30And50 = Math.max(0, (patientData.statistics.percentAbove30 || 0) - (patientData.statistics.percentAbove50 || 0));
    const above50 = patientData.statistics.percentAbove50 || 0;
    
    rangeValues = [below5, between5And10, targetRange, between30And50, above50];
    rangeLabels = ["Very Low<br><5", "Low<br>5-10", "Normal<br>10-30", "High<br>30-50", "Very High<br>>50"];
    rangeColors = ["#3b82f6", "#60a5fa", "#10b981", "#f59e0b", "#dc2626"];
    unit = "ng/mL";
  }
  
  console.log("Time in range values:", rangeValues);
  
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
      range: biomarkerType === 'glucose' ? [0, 400] : [0, 100],
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
        y0: 70,
        y1: 180,
        fillcolor: "rgba(16, 185, 129, 0.1)",
        line: { color: "rgba(16, 185, 129, 0.3)", width: 1 },
        layer: "below",
      },
    ] : [
      {
        type: "rect",
        x0: 0,
        x1: 23,
        y0: 10,
        y1: 30,
        fillcolor: "rgba(16, 185, 129, 0.1)",
        line: { color: "rgba(16, 185, 129, 0.3)", width: 1 },
        layer: "below",
      },
    ],
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/")}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            {biomarkerType === 'glucose' ? 'AGP Report: Continuous Glucose Monitoring' : 'ACP Report: Continuous Cortisol Monitoring'}
          </Typography>
          
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
      </Box>

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
          TIME IN RANGES
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'center', width: '95%' }}>
          {/* Y-axis labels */}
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 350, py: 1, minWidth: 40 }}>
            {biomarkerType === 'glucose' ? (
              <>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>350</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>250</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>180</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>70</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>54</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>0</Typography>
              </>
            ) : (
              <>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>70</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>50</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>30</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>10</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>5</Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>0</Typography>
              </>
            )}
          </Box>
          
          {/* Stacked Bar */}
          <Box sx={{ width: 100, height: 350, position: 'relative', border: '2px solid #333', borderRadius: 1 }}>
            {rangeValues.map((value, index) => {
              const cumulativeTop = rangeValues.slice(0, index).reduce((sum, val) => sum + val, 0) * 3.5;
              return (
                <Box
                  key={index}
                  sx={{
                    position: 'absolute',
                    top: `${cumulativeTop}px`,
                    left: 0,
                    right: 0,
                    height: `${value * 3.5}px`,
                    backgroundColor: rangeColors[index],
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
          
          {/* Range Labels and Values */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5, ml: 2, minWidth: 280 }}>
            {biomarkerType === 'glucose' ? (
              <>
                {/* Very High Glucose */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[4], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very High <span style={{color: '#666', fontWeight: 'normal'}}>(&gt;250 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[4]}% ({Math.floor(rangeValues[4] * 24 / 100)}h {Math.round((rangeValues[4] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[3], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    High <span style={{color: '#666', fontWeight: 'normal'}}>(181-250 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[3]}% ({Math.floor(rangeValues[3] * 24 / 100)}h {Math.round((rangeValues[3] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[2], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Target Range <span style={{color: '#666', fontWeight: 'normal'}}>(70-180 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[2]}% ({Math.floor(rangeValues[2] * 24 / 100)}h {Math.round((rangeValues[2] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[1], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Low <span style={{color: '#666', fontWeight: 'normal'}}>(54-69 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[1]}% ({Math.floor(rangeValues[1] * 24 / 100)}h {Math.round((rangeValues[1] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[0], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very Low <span style={{color: '#666', fontWeight: 'normal'}}>(&lt;54 mg/dL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[0]}% ({Math.floor(rangeValues[0] * 24 / 100)}h {Math.round((rangeValues[0] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                {/* Very High Cortisol */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[4], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very High <span style={{color: '#666', fontWeight: 'normal'}}>(&gt;50 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[4]}% ({Math.floor(rangeValues[4] * 24 / 100)}h {Math.round((rangeValues[4] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[3], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    High <span style={{color: '#666', fontWeight: 'normal'}}>(30-50 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[3]}% ({Math.floor(rangeValues[3] * 24 / 100)}h {Math.round((rangeValues[3] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[2], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Normal Range <span style={{color: '#666', fontWeight: 'normal'}}>(10-30 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[2]}% ({Math.floor(rangeValues[2] * 24 / 100)}h {Math.round((rangeValues[2] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[1], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Low <span style={{color: '#666', fontWeight: 'normal'}}>(5-10 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[1]}% ({Math.floor(rangeValues[1] * 24 / 100)}h {Math.round((rangeValues[1] * 24 / 100 % 1) * 60)}min)
                    </span>
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 24, height: 24, backgroundColor: rangeColors[0], borderRadius: 0.5 }}></Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '15px', lineHeight: 1.3 }}>
                    Very Low <span style={{color: '#666', fontWeight: 'normal'}}>(&lt;5 ng/mL)</span>
                    <br />
                    <span style={{color: '#666', fontWeight: 'normal', fontSize: '14px'}}>
                      {rangeValues[0]}% ({Math.floor(rangeValues[0] * 24 / 100)}h {Math.round((rangeValues[0] * 24 / 100 % 1) * 60)}min)
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
                Target &gt;70% ({Math.round(patientData.statistics.percentBetween70And180 * 24 * 0.7 / 100)}h {Math.round(patientData.statistics.percentBetween70And180 * 24 * 0.7 % 60)}min)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 70 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 4% ({Math.round(patientData.statistics.percentBelow70 * 24 * 0.4 / 100)}h {Math.round(patientData.statistics.percentBelow70 * 24 * 0.4 % 60)}min)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 54 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 1% ({Math.round(patientData.statistics.percentBelow54 * 24 * 0.1 / 100)}h {Math.round(patientData.statistics.percentBelow54 * 24 * 0.1 % 60)}min)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 180 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 25% ({Math.round(patientData.statistics.percentAbove180 * 24 * 0.25 / 100)}h)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 250 mg/dL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 5% ({Math.round((patientData.statistics.percentAbove250 || 0) * 24 * 0.6 / 100)}h {Math.round((patientData.statistics.percentAbove250 || 0) * 24 * 0.6 % 60)}min)
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
                Normal Range 10–30 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Target 60-80% ({Math.round(patientData.statistics.percentBetween10And30 * 24 * 0.6 / 100)}h {Math.round(patientData.statistics.percentBetween10And30 * 24 * 0.6 % 60)}min)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 10 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 10% ({Math.round(patientData.statistics.percentBelow10 * 24 * 0.6 / 100)}h {Math.round(patientData.statistics.percentBelow10 * 24 * 0.6 % 60)}min)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Below 5 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 2% ({Math.round(patientData.statistics.percentBelow5 * 24 * 0.6 / 100)}h {Math.round(patientData.statistics.percentBelow5 * 24 * 0.6 % 60)}min)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 30 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 20% ({Math.round(patientData.statistics.percentAbove30 * 24 * 0.6 / 100)}h)
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5, width: '90%' }} />
            
            <Box sx={{ display: 'flex', py: 1, alignItems: 'center', width: '90%' }}>
              <Typography variant="body2" sx={{ flex: 2 }}>
                Above 50 ng/mL
              </Typography>
              <Typography variant="body2" sx={{ flex: 1.5, textAlign: 'center' }}>
                Less than 5% ({Math.round((patientData.statistics.percentAbove50 || 0) * 24 * 0.6 / 100)}h {Math.round((patientData.statistics.percentAbove50 || 0) * 24 * 0.6 % 60)}min)
              </Typography>
            </Box>
            
            {/* Clinical Note */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd', width: '90%' }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.875rem', textAlign: 'center' }}>
                Maintaining cortisol in normal range (10-30 ng/mL) is important for stress response and metabolic health.
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
              {/* Average Value */}
              <Grid item xs={12} sm={6} md={3}>
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
                <Grid item xs={12} sm={6} md={3}>
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
                <Grid item xs={12} sm={6} md={3}>
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
              <Grid item xs={12} sm={6} md={3}>
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
    </Container>
  );
}

export default AGPReport; 