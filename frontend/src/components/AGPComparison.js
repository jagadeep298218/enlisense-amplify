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
  ToggleButtonGroup,
  Chip
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

  useEffect(() => {
    const fetchComparisonData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found");
        }

        const response = await fetch(`http://localhost:3000/agp-comparison/${username1}/${username2}/${biomarkerType}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        setComparisonData(data);
      } catch (error) {
        console.error("Error fetching comparison data:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (username1 && username2) {
      fetchComparisonData();
    }
  }, [username1, username2, biomarkerType]);

  const createAGPChart = (patientData, title) => {
    if (!patientData || patientData.error) {
      return null;
    }

    const percentiles = patientData.percentages || patientData.percentiles;

    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const unit = biomarkerType === 'glucose' ? 'mg/dL' : 'ng/mL';

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
        tickfont: { size: 10 }
      },
      margin: { l: 60, r: 40, t: 40, b: 60 },
      height: 400,
      showlegend: false,
      plot_bgcolor: "white",
      paper_bgcolor: "white",
    };

    return <Plot data={agpData} layout={layout} style={{ width: "100%", height: "100%" }} />;
  };

  const createTimeInRangeChart = (patientData, title) => {
    if (!patientData || patientData.error) {
      return null;
    }



    let rangeValues, rangeLabels, rangeColors, unit;
    
    if (biomarkerType === 'glucose') {
      const stats = patientData.statistics.statistics || patientData.statistics;
      const below54 = stats.percentBelow54 || 0;
      const between54And69 = Math.max(0, (stats.percentBelow70 || 0) - below54);
      const targetRange = stats.percentBetween70And180 || 0;
      const between181And250 = Math.max(0, (stats.percentAbove180 || 0) - (stats.percentAbove250 || 0));
      const above250 = stats.percentAbove250 || 0;
      
      rangeValues = [below54, between54And69, targetRange, between181And250, above250];
      rangeLabels = ["Very Low<br><54", "Low<br>54-69", "Target<br>70-180", "High<br>181-250", "Very High<br>>250"];
      rangeColors = ["#dc2626", "#f59e0b", "#10b981", "#f59e0b", "#dc2626"];
      unit = "mg/dL";
    } else {
      const stats = patientData.statistics.statistics || patientData.statistics;
      const below5 = stats.percentBelow5 || 0;
      const between5And10 = Math.max(0, (stats.percentBelow10 || 0) - below5);
      const targetRange = stats.percentBetween10And30 || 0;
      const between30And50 = Math.max(0, (stats.percentAbove30 || 0) - (stats.percentAbove50 || 0));
      const above50 = stats.percentAbove50 || 0;
      
      rangeValues = [below5, between5And10, targetRange, between30And50, above50];
      rangeLabels = ["Very Low<br><5", "Low<br>5-10", "Normal<br>10-30", "High<br>30-50", "Very High<br>>50"];
      rangeColors = ["#3b82f6", "#60a5fa", "#10b981", "#f59e0b", "#dc2626"];
      unit = "ng/mL";
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
        text: rangeValues.map(val => `${val}%`),
        textposition: "auto",
        textfont: { color: "white", size: 12, family: "Arial Black" },
        hovertemplate: "<b>%{x}</b><br>%{y}%<extra></extra>",
      },
    ];

    const layout = {
      title: {
        text: title,
        font: { size: 16, family: "Arial" },
      },
      xaxis: {
        title: {
          text: `${biomarkerType === 'glucose' ? 'Glucose' : 'Cortisol'} Range (${unit})`,
          font: { size: 12 }
        },
        tickfont: { size: 10 }
      },
      yaxis: {
        title: {
          text: "Percentage (%)",
          font: { size: 12 }
        },
        range: [0, 100],
        tickfont: { size: 10 }
      },
      margin: { l: 60, r: 40, t: 40, b: 80 },
      height: 400,
      width: 710,
      showlegend: false,
      bargap: 0.4,
      plot_bgcolor: "white",
      paper_bgcolor: "white",
    };

    return <Plot data={timeInRangeData} layout={layout} style={{ width: "100%", height: "100%" }} />;
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>Loading comparison data...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Alert severity="error">Error loading comparison data: {error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 4, px: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareIcon color="primary" />
          AGP Report Comparison
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Chip
            icon={<PersonIcon />}
            label={`Patient 1: ${username1}`}
            color="primary"
            variant="outlined"
          />
          <Typography variant="h6">vs</Typography>
          <Chip
            icon={<PersonIcon />}
            label={`Patient 2: ${username2}`}
            color="secondary"
            variant="outlined"
          />
        </Box>

        <ToggleButtonGroup
          value={biomarkerType}
          exclusive
          onChange={(event, newType) => {
            if (newType) {
              setBiomarkerType(newType);
              navigate(`/agp-comparison/${username1}/${username2}/${newType}`);
            }
          }}
          size="small"
        >
          <ToggleButton value="glucose">Glucose</ToggleButton>
          <ToggleButton value="cortisol">Cortisol</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {comparisonData && (
        <Grid container spacing={4}>
          {/* Patient 1 Column */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon />
                {comparisonData.patient1.username}
              </Typography>
              
              {comparisonData.patient1.data.error ? (
                <Alert severity="error">{comparisonData.patient1.data.error}</Alert>
              ) : (
                <>
                  {/* Patient 1 Device Info */}
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Patient Information</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        <Typography variant="body2"><strong>Gender:</strong> {comparisonData.patient1.data.device_info?.gender || 'N/A'}</Typography>
                        <Typography variant="body2"><strong>Age:</strong> {comparisonData.patient1.data.device_info?.age || 'N/A'}</Typography>
                        <Typography variant="body2"><strong>Device:</strong> {comparisonData.patient1.data.device_info?.deviceID || 'N/A'}</Typography>
                        <Typography variant="body2"><strong>Readings:</strong> {comparisonData.patient1.data.totalReadings || 0}</Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Patient 1 Time in Range */}
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      {createTimeInRangeChart(comparisonData.patient1.data, "Time in Range")}
                    </CardContent>
                  </Card>

                  {/* Patient 1 AGP Chart */}
                  <Card>
                    <CardContent>
                      {createAGPChart(comparisonData.patient1.data, "Ambulatory Glucose Profile")}
                    </CardContent>
                  </Card>
                </>
              )}
            </Paper>
          </Grid>

          {/* Patient 2 Column */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom color="secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon />
                {comparisonData.patient2.username}
              </Typography>
              
              {comparisonData.patient2.data.error ? (
                <Alert severity="error">{comparisonData.patient2.data.error}</Alert>
              ) : (
                <>
                  {/* Patient 2 Device Info */}
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Patient Information</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        <Typography variant="body2"><strong>Gender:</strong> {comparisonData.patient2.data.device_info?.gender || 'N/A'}</Typography>
                        <Typography variant="body2"><strong>Age:</strong> {comparisonData.patient2.data.device_info?.age || 'N/A'}</Typography>
                        <Typography variant="body2"><strong>Device:</strong> {comparisonData.patient2.data.device_info?.deviceID || 'N/A'}</Typography>
                        <Typography variant="body2"><strong>Readings:</strong> {comparisonData.patient2.data.totalReadings || 0}</Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Patient 2 Time in Range */}
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      {createTimeInRangeChart(comparisonData.patient2.data, "Time in Range")}
                    </CardContent>
                  </Card>

                  {/* Patient 2 AGP Chart */}
                  <Card>
                    <CardContent>
                      {createAGPChart(comparisonData.patient2.data, "Ambulatory Glucose Profile")}
                    </CardContent>
                  </Card>
                </>
              )}
            </Paper>
          </Grid>

          {/* Enhanced Summary Comparison */}
          <Grid item xs={12}>
            <Paper sx={{ p: 4, bgcolor: 'background.paper' }}>
              <Typography 
                variant="h4" 
                gutterBottom 
                sx={{ 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}
              >
                <CompareIcon fontSize="large" />
                Clinical Comparison Summary
              </Typography>
              
              {comparisonData.patient1.data.error || comparisonData.patient2.data.error ? (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  Unable to generate comparison summary due to missing data.
                </Alert>
              ) : (
                <Grid container spacing={3} justifyContent="center" alignItems="stretch">
                  {/* Patient 1 Summary Card */}
                  <Grid item xs={12} lg={5}>
                    <Card sx={{ 
                      height: '100%',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography 
                          variant="h5" 
                          gutterBottom 
                          sx={{ 
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 3
                          }}
                        >
                          <PersonIcon />
                          {comparisonData.patient1.username}
                        </Typography>
                        
                        {comparisonData.patient1.data.statistics.statistics && 
                          Object.entries(comparisonData.patient1.data.statistics.statistics).map(([key, value]) => {
                            const isPercentage = key.includes('percent') || key.includes('Percentage');
                            const isGlucose = key.includes('average') || key.includes('a1c') || key.includes('gmi');
                            
                            return (
                              <Box 
                                key={key} 
                                sx={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  py: 1.5,
                                  px: 2,
                                  mb: 1,
                                  backgroundColor: 'background.default',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'divider'
                                }}
                              >
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                </Typography>
                                <Chip
                                  label={
                                    typeof value === 'number' 
                                      ? `${value.toFixed(1)}${isPercentage ? '%' : isGlucose && !key.includes('Percentage') ? (key.includes('a1c') || key.includes('gmi') ? '%' : ' mg/dL') : ''}`
                                      : String(value)
                                  }
                                  variant="outlined"
                                  sx={{ 
                                    fontWeight: 'bold',
                                    minWidth: '80px',
                                    '& .MuiChip-label': { fontSize: '0.9rem' }
                                  }}
                                />
                              </Box>
                            );
                          })
                        }
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Patient 2 Summary Card */}
                  <Grid item xs={12} lg={5}>
                    <Card sx={{ 
                      height: '100%',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)' }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography 
                          variant="h5" 
                          gutterBottom 
                          sx={{ 
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 3
                          }}
                        >
                          <PersonIcon />
                          {comparisonData.patient2.username}
                        </Typography>
                        
                        {comparisonData.patient2.data.statistics.statistics && 
                          Object.entries(comparisonData.patient2.data.statistics.statistics).map(([key, value]) => {
                            const isPercentage = key.includes('percent') || key.includes('Percentage');
                            const isGlucose = key.includes('average') || key.includes('a1c') || key.includes('gmi');
                            
                            return (
                              <Box 
                                key={key} 
                                sx={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  py: 1.5,
                                  px: 2,
                                  mb: 1,
                                  backgroundColor: 'background.default',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'divider'
                                }}
                              >
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                </Typography>
                                <Chip
                                  label={
                                    typeof value === 'number' 
                                      ? `${value.toFixed(1)}${isPercentage ? '%' : isGlucose && !key.includes('Percentage') ? (key.includes('a1c') || key.includes('gmi') ? '%' : ' mg/dL') : ''}`
                                      : String(value)
                                  }
                                  variant="outlined"
                                  sx={{ 
                                    fontWeight: 'bold',
                                    minWidth: '80px',
                                    '& .MuiChip-label': { fontSize: '0.9rem' }
                                  }}
                                />
                              </Box>
                            );
                          })
                        }
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Key Differences Highlight */}
                  <Grid item xs={12} lg={10}>
                    <Card sx={{ 
                      mt: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography 
                          variant="h6" 
                          gutterBottom 
                          sx={{ 
                            fontWeight: 'bold',
                            textAlign: 'center',
                            mb: 2
                          }}
                        >
                          📊 Key Insights
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                          {biomarkerType === 'glucose' && comparisonData.patient1.data.statistics.statistics && comparisonData.patient2.data.statistics.statistics && (
                            <>
                              <Chip
                                label={`Average Difference: ${Math.abs(
                                  comparisonData.patient1.data.statistics.statistics.average - 
                                  comparisonData.patient2.data.statistics.statistics.average
                                ).toFixed(1)} mg/dL`}
                                variant="outlined"
                                sx={{ fontWeight: 'bold' }}
                              />
                              <Chip
                                label={`Time in Range Diff: ${Math.abs(
                                  comparisonData.patient1.data.statistics.statistics.percentBetween70And180 - 
                                  comparisonData.patient2.data.statistics.statistics.percentBetween70And180
                                ).toFixed(1)}%`}
                                variant="outlined"
                                sx={{ fontWeight: 'bold' }}
                              />
                              <Chip
                                label={`A1C Difference: ${Math.abs(
                                  comparisonData.patient1.data.statistics.statistics.a1c - 
                                  comparisonData.patient2.data.statistics.statistics.a1c
                                ).toFixed(1)}%`}
                                variant="outlined"
                                sx={{ fontWeight: 'bold' }}
                              />
                            </>
                          )}
                          <Chip
                            label={`📅 Comparison Date: ${new Date(comparisonData.comparedAt).toLocaleDateString()}`}
                            variant="outlined"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

export default AGPComparison; 