import React, { useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { Box, Typography, Paper, Grid, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const ViolinPlot = ({ sensorData, title = "Time Series Violin Plot Analysis" }) => {
    const [selectedBiomarker, setSelectedBiomarker] = React.useState('cortisol');
    const [maxTimePoints, setMaxTimePoints] = React.useState(20);

    const prepareTimeSeriesViolinData = () => {
        if (!sensorData || sensorData.length === 0) return null;

        // Group data by timestamp and biomarker type
        const timeGroups = {};
        
        sensorData.forEach(point => {
            const timestamp = point.timestamp || point.dateTime;
            if (!timestamp) return;
            
            const timeKey = new Date(timestamp).toISOString();
            
            if (!timeGroups[timeKey]) {
                timeGroups[timeKey] = {
                    timestamp: timestamp,
                    cortisol: [],
                    glucose: []
                };
            }
            
            // Add sensor values for this timestamp
            if (point.cortisol1 !== null && point.cortisol1 !== undefined && !isNaN(parseFloat(point.cortisol1))) {
                timeGroups[timeKey].cortisol.push(parseFloat(point.cortisol1));
            }
            if (point.cortisol2 !== null && point.cortisol2 !== undefined && !isNaN(parseFloat(point.cortisol2))) {
                timeGroups[timeKey].cortisol.push(parseFloat(point.cortisol2));
            }
            if (point.glucose1 !== null && point.glucose1 !== undefined && !isNaN(parseFloat(point.glucose1))) {
                timeGroups[timeKey].glucose.push(parseFloat(point.glucose1));
            }
            if (point.glucose2 !== null && point.glucose2 !== undefined && !isNaN(parseFloat(point.glucose2))) {
                timeGroups[timeKey].glucose.push(parseFloat(point.glucose2));
            }
        });

        // Sort by timestamp and limit to maxTimePoints
        const sortedTimeGroups = Object.values(timeGroups)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Apply time point limit (if not "All Time Points")
        const limitedTimeGroups = maxTimePoints === -1 ? sortedTimeGroups : sortedTimeGroups.slice(0, maxTimePoints);

        return limitedTimeGroups;
    };

    const createViolinPlotData = () => {
        const timeSeriesData = prepareTimeSeriesViolinData();
        if (!timeSeriesData || timeSeriesData.length === 0) return null;

        const plotData = [];
        const xLabels = [];

        timeSeriesData.forEach((timeGroup, index) => {
            const biomarkerData = timeGroup[selectedBiomarker];
            
            // Only create violin if we have at least 2 data points for meaningful distribution
            if (biomarkerData.length >= 2) {
                const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                xLabels.push(timeLabel);
                
                plotData.push({
                    type: 'violin',
                    y: biomarkerData,
                    x: Array(biomarkerData.length).fill(timeLabel),
                    name: timeLabel,
                    box: {
                        visible: true,
                        width: 0.3
                    },
                    meanline: {
                        visible: true
                    },
                    points: 'all',
                    pointpos: 0,
                    jitter: 0.3,
                    fillcolor: selectedBiomarker === 'cortisol' ? 
                        `rgba(136, 132, 216, ${0.3 + (index * 0.02)})` : 
                        `rgba(130, 202, 157, ${0.3 + (index * 0.02)})`,
                    line: {
                        color: selectedBiomarker === 'cortisol' ? 
                            'rgb(136, 132, 216)' : 
                            'rgb(130, 202, 157)'
                    },
                    marker: {
                        size: 3,
                        color: selectedBiomarker === 'cortisol' ? 
                            'rgba(136, 132, 216, 0.8)' : 
                            'rgba(130, 202, 157, 0.8)',
                        line: {
                            width: 0.5,
                            color: selectedBiomarker === 'cortisol' ? 
                                'rgb(136, 132, 216)' : 
                                'rgb(130, 202, 157)'
                        }
                    },
                    scalemode: 'width',
                    width: 0.8
                });
            } else if (biomarkerData.length === 1) {
                // For single points, create a scatter plot instead
                const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                xLabels.push(timeLabel);
                
                plotData.push({
                    type: 'scatter',
                    mode: 'markers',
                    y: biomarkerData,
                    x: [timeLabel],
                    name: timeLabel,
                    marker: {
                        size: 8,
                        color: selectedBiomarker === 'cortisol' ? 
                            'rgba(136, 132, 216, 0.8)' : 
                            'rgba(130, 202, 157, 0.8)',
                        line: {
                            width: 2,
                            color: selectedBiomarker === 'cortisol' ? 
                                'rgb(136, 132, 216)' : 
                                'rgb(130, 202, 157)'
                        }
                    }
                });
            }
        });

        return { plotData, xLabels };
    };

    const plotResult = createViolinPlotData();

    if (!plotResult || plotResult.plotData.length === 0) {
        return (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                    No sufficient data available for time series violin plot visualization
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Each time point needs multiple sensor readings to create meaningful violin plots.
                </Typography>
            </Paper>
        );
    }

    const plotLayout = {
        title: {
            text: `${selectedBiomarker.charAt(0).toUpperCase() + selectedBiomarker.slice(1)} Distribution Over Time`,
            font: { size: 20 }
        },
        xaxis: {
            title: 'Time Points',
            titlefont: { size: 14 },
            tickangle: -45,
            type: 'category'
        },
        yaxis: {
            title: selectedBiomarker === 'cortisol' ? 'Cortisol (ng/mL)' : 'Glucose (mg/dL)',
            titlefont: { size: 14 },
            zeroline: false
        },
        showlegend: false,
        margin: { t: 80, b: 100, l: 80, r: 50 },
        height: 600,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        violinmode: 'group',
        violingap: 0.3,
        violingroupgap: 0.3
    };

    const plotConfig = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };

    const getDataSummary = () => {
        const timeSeriesData = prepareTimeSeriesViolinData();
        if (!timeSeriesData) return null;

        const biomarkerCounts = timeSeriesData.map(group => ({
            time: new Date(group.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            count: group[selectedBiomarker].length,
            values: group[selectedBiomarker]
        })).filter(item => item.count > 0);

        const totalReadings = biomarkerCounts.reduce((sum, item) => sum + item.count, 0);
        const avgReadingsPerTime = totalReadings / biomarkerCounts.length;

        return {
            totalTimePoints: biomarkerCounts.length,
            totalReadings,
            avgReadingsPerTime: avgReadingsPerTime.toFixed(1),
            timePointsWithMultipleReadings: biomarkerCounts.filter(item => item.count > 1).length
        };
    };

    const summary = getDataSummary();

    return (
        <Box sx={{ width: '100%', p: 2 }}>
            <Typography variant="h5" gutterBottom align="center" color="primary" sx={{ mb: 3 }}>
                {title}
            </Typography>
            
            {/* Controls */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                            <InputLabel>Biomarker</InputLabel>
                            <Select
                                value={selectedBiomarker}
                                onChange={(e) => setSelectedBiomarker(e.target.value)}
                                label="Biomarker"
                            >
                                <MenuItem value="cortisol">Cortisol (ng/mL)</MenuItem>
                                <MenuItem value="glucose">Glucose (mg/dL)</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                                                                <FormControl fullWidth>
                                            <InputLabel>Max Time Points</InputLabel>
                                            <Select
                                                value={maxTimePoints}
                                                onChange={(e) => setMaxTimePoints(e.target.value)}
                                                label="Max Time Points"
                                            >
                                                <MenuItem value={10}>10 Time Points</MenuItem>
                                                <MenuItem value={20}>20 Time Points</MenuItem>
                                                <MenuItem value={50}>50 Time Points</MenuItem>
                                                <MenuItem value={100}>100 Time Points</MenuItem>
                                                <MenuItem value={-1}>All Time Points</MenuItem>
                                            </Select>
                                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                            Showing distribution of sensor readings at each time point
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* Violin Plot */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Plot
                    data={plotResult.plotData}
                    layout={plotLayout}
                    config={plotConfig}
                    useResizeHandler={false}
                    style={{ width: '100%', height: '650px' }}
                />
            </Paper>

            {/* Summary Statistics */}
            {summary && (
                <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                    <Typography variant="h6" gutterBottom color="primary">
                        Time Series Analysis Summary
                    </Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={3}>
                            <Typography variant="body2" color="text.secondary">
                                Total Time Points:
                            </Typography>
                            <Typography variant="h6">
                                {summary.totalTimePoints}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Typography variant="body2" color="text.secondary">
                                Total Sensor Readings:
                            </Typography>
                            <Typography variant="h6">
                                {summary.totalReadings}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Typography variant="body2" color="text.secondary">
                                Avg Readings per Time:
                            </Typography>
                            <Typography variant="h6">
                                {summary.avgReadingsPerTime}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Typography variant="body2" color="text.secondary">
                                Violin Plots (≥2 readings):
                            </Typography>
                            <Typography variant="h6">
                                {summary.timePointsWithMultipleReadings}
                            </Typography>
                        </Grid>
                    </Grid>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Each violin shows the distribution of sensor readings (Sensor 1 & 2) at a specific time point.
                        Single readings are shown as scatter points.
                    </Typography>
                </Paper>
            )}
        </Box>
    );
};

export default ViolinPlot; 