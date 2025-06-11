import React, { useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { Box, Typography, Paper, Grid } from '@mui/material';

const ViolinPlot = ({ sensorData, title = "Sensor Data Distribution" }) => {
    const preparePlotData = () => {
        if (!sensorData || sensorData.length === 0) return null;

        // Extract data for violin plots
        const cortisol1Data = sensorData
            .map(point => point.cortisol1)
            .filter(val => val !== null && val !== undefined && !isNaN(val));
        
        const glucose1Data = sensorData
            .map(point => point.glucose1)
            .filter(val => val !== null && val !== undefined && !isNaN(val));
            
        const cortisol2Data = sensorData
            .map(point => point.cortisol2)
            .filter(val => val !== null && val !== undefined && !isNaN(val));
            
        const glucose2Data = sensorData
            .map(point => point.glucose2)
            .filter(val => val !== null && val !== undefined && !isNaN(val));

        return {
            cortisol1Data,
            glucose1Data,
            cortisol2Data,
            glucose2Data
        };
    };

    const plotData = preparePlotData();

    if (!plotData || (plotData.cortisol1Data.length === 0 && plotData.glucose1Data.length === 0 && 
                      plotData.cortisol2Data.length === 0 && plotData.glucose2Data.length === 0)) {
        return (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                    No data available for violin plot visualization
                </Typography>
            </Paper>
        );
    }

    // Combine data from both sensors for each biomarker
    const combinedCortisolData = [...plotData.cortisol1Data, ...plotData.cortisol2Data];
    const combinedGlucoseData = [...plotData.glucose1Data, ...plotData.glucose2Data];

    // Create separate plots for cortisol and glucose
    const cortisolPlot = {
        data: [
            ...(combinedCortisolData.length > 0 ? [{
                type: 'violin',
                y: combinedCortisolData,
                name: 'Cortisol (ng/mL)',
                box: {
                    visible: true
                },
                meanline: {
                    visible: true
                },
                fillcolor: 'rgba(136, 132, 216, 0.6)',
                line: {
                    color: 'rgb(136, 132, 216)'
                },
                x0: 'Cortisol',
                points: 'all',
                pointpos: 0,
                jitter: 0.3,
                marker: {
                    size: 4,
                    color: 'rgba(136, 132, 216, 0.8)',
                    line: {
                        width: 0.5,
                        color: 'rgb(136, 132, 216)'
                    }
                }
            }] : [])
        ],
        layout: {
            title: {
                text: 'Cortisol Distribution (ng/mL) - Combined Sensor Data',
                font: { size: 18 }
            },
            yaxis: {
                title: 'Cortisol (ng/mL)',
                zeroline: false,
                titlefont: { size: 14 }
            },
            xaxis: {
                title: 'Biomarker',
                titlefont: { size: 14 }
            },
            showlegend: false,
            margin: { t: 60, b: 60, l: 80, r: 50 },
            width: null,
            height: 400,
            autosize: false
        },
        config: {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
        }
    };

    const glucosePlot = {
        data: [
            ...(combinedGlucoseData.length > 0 ? [{
                type: 'violin',
                y: combinedGlucoseData,
                name: 'Glucose (mg/dL)',
                box: {
                    visible: true
                },
                meanline: {
                    visible: true
                },
                fillcolor: 'rgba(130, 202, 157, 0.6)',
                line: {
                    color: 'rgb(130, 202, 157)'
                },
                x0: 'Glucose',
                points: 'all',
                pointpos: 0,
                jitter: 0.3,
                marker: {
                    size: 4,
                    color: 'rgba(130, 202, 157, 0.8)',
                    line: {
                        width: 0.5,
                        color: 'rgb(130, 202, 157)'
                    }
                }
            }] : [])
        ],
        layout: {
            title: {
                text: 'Glucose Distribution (mg/dL) - Combined Sensor Data',
                font: { size: 18 }
            },
            yaxis: {
                title: 'Glucose (mg/dL)',
                zeroline: false,
                titlefont: { size: 14 }
            },
            xaxis: {
                title: 'Biomarker',
                titlefont: { size: 14 }
            },
            showlegend: false,
            margin: { t: 60, b: 60, l: 80, r: 50 },
            width: null,
            height: 400,
            autosize: false
        },
        config: {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
        }
    };

    return (
        <Box sx={{ width: '100%', p: 2 }}>
            <Typography variant="h5" gutterBottom align="center" color="primary" sx={{ mb: 3 }}>
                {title}
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, mb: 3 }}>
                {/* Cortisol Distribution Plot */}
                <Paper sx={{ p: 2, flex: 1, minWidth: 0 }}>
                    <Plot
                        data={cortisolPlot.data}
                        layout={cortisolPlot.layout}
                        config={cortisolPlot.config}
                        useResizeHandler={false}
                        style={{ width: '100%', height: '500px' }}
                    />
                </Paper>

                {/* Glucose Distribution Plot */}
                <Paper sx={{ p: 2, flex: 1, minWidth: 0 }}>
                    <Plot
                        data={glucosePlot.data}
                        layout={glucosePlot.layout}
                        config={glucosePlot.config}
                        useResizeHandler={false}
                        style={{ width: '100%', height: '500px' }}
                    />
                </Paper>
            </Box>

            {/* Data Summary */}
            <Paper sx={{ p: 3, mt: 3, bgcolor: 'background.default' }}>
                <Typography variant="h6" gutterBottom color="primary">
                    Data Summary
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" color="primary" gutterBottom>
                            Cortisol (ng/mL)
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                    Total Data Points:
                                </Typography>
                                <Typography variant="h6">
                                    {combinedCortisolData.length}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                    Sensor Breakdown:
                                </Typography>
                                <Typography variant="body1">
                                    Sensor 1: {plotData.cortisol1Data.length}
                                </Typography>
                                <Typography variant="body1">
                                    Sensor 2: {plotData.cortisol2Data.length}
                                </Typography>
                            </Grid>
                        </Grid>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" color="primary" gutterBottom>
                            Glucose (mg/dL)
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                    Total Data Points:
                                </Typography>
                                <Typography variant="h6">
                                    {combinedGlucoseData.length}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                    Sensor Breakdown:
                                </Typography>
                                <Typography variant="body1">
                                    Sensor 1: {plotData.glucose1Data.length}
                                </Typography>
                                <Typography variant="body1">
                                    Sensor 2: {plotData.glucose2Data.length}
                                </Typography>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default ViolinPlot; 