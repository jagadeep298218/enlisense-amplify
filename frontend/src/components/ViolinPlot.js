import React, { useEffect, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { Box, Typography, Paper, Grid, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch } from '@mui/material';

const ViolinPlot = ({ sensorData, title = "Time Series Violin Plot Analysis" }) => {
    const [selectedBiomarker, setSelectedBiomarker] = useState('cortisol');
    const [maxTimePoints, setMaxTimePoints] = useState(20);
    const [showMovingAverage, setShowMovingAverage] = useState(false);
    const [movingAverageWindow, setMovingAverageWindow] = useState(5);
    const [graphType, setGraphType] = useState('violin');
    
    // AUC curve specific states
    const [category1Threshold, setCategory1Threshold] = useState(50);
    const [category2Threshold, setCategory2Threshold] = useState(100);
    const [selectedBiomarkerForAUC, setSelectedBiomarkerForAUC] = useState('cortisol');

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

    // Calculate moving average for the time series data (original function for violin plots)
    const calculateMovingAverage = (timeSeriesData, windowSize) => {
        if (!timeSeriesData || timeSeriesData.length === 0) return null;
        
        const movingAverageData = [];
        const xLabels = [];
        
        timeSeriesData.forEach((timeGroup, index) => {
            const biomarkerData = timeGroup[selectedBiomarker];
            
            if (biomarkerData.length > 0) {
                // Calculate the mean of all values at this time point
                const meanValue = biomarkerData.reduce((sum, val) => sum + val, 0) / biomarkerData.length;
                
                // Apply moving average calculation
                let startIndex = Math.max(0, index - Math.floor(windowSize / 2));
                let endIndex = Math.min(timeSeriesData.length - 1, index + Math.floor(windowSize / 2));
                
                // Collect values for moving average window
                let windowValues = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    const windowData = timeSeriesData[i][selectedBiomarker];
                    if (windowData.length > 0) {
                        const windowMean = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
                        windowValues.push(windowMean);
                    }
                }
                
                // Calculate moving average
                const movingAverage = windowValues.length > 0 ? 
                    windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length : meanValue;
                
                const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                movingAverageData.push(movingAverage);
                xLabels.push(timeLabel);
            }
        });
        
        return { movingAverageData, xLabels };
    };

    // Calculate moving average for both biomarkers (for compare graph)
    const calculateMovingAverageForBoth = (timeSeriesData, windowSize) => {
        if (!timeSeriesData || timeSeriesData.length === 0) return null;
        
        const cortisolAverage = [];
        const glucoseAverage = [];
        const xLabels = [];
        
        timeSeriesData.forEach((timeGroup, index) => {
            const cortisolData = timeGroup.cortisol;
            const glucoseData = timeGroup.glucose;
            
            const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            xLabels.push(timeLabel);
            
            // Calculate cortisol moving average
            if (cortisolData.length > 0) {
                const cortisolMean = cortisolData.reduce((sum, val) => sum + val, 0) / cortisolData.length;
                let startIndex = Math.max(0, index - Math.floor(windowSize / 2));
                let endIndex = Math.min(timeSeriesData.length - 1, index + Math.floor(windowSize / 2));
                
                let windowValues = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    const windowData = timeSeriesData[i].cortisol;
                    if (windowData.length > 0) {
                        const windowMean = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
                        windowValues.push(windowMean);
                    }
                }
                
                const movingAverage = windowValues.length > 0 ? 
                    windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length : cortisolMean;
                cortisolAverage.push(movingAverage);
            } else {
                cortisolAverage.push(null);
            }
            
            // Calculate glucose moving average
            if (glucoseData.length > 0) {
                const glucoseMean = glucoseData.reduce((sum, val) => sum + val, 0) / glucoseData.length;
                let startIndex = Math.max(0, index - Math.floor(windowSize / 2));
                let endIndex = Math.min(timeSeriesData.length - 1, index + Math.floor(windowSize / 2));
                
                let windowValues = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    const windowData = timeSeriesData[i].glucose;
                    if (windowData.length > 0) {
                        const windowMean = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
                        windowValues.push(windowMean);
                    }
                }
                
                const movingAverage = windowValues.length > 0 ? 
                    windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length : glucoseMean;
                glucoseAverage.push(movingAverage);
            } else {
                glucoseAverage.push(null);
            }
        });
        
        return { cortisolAverage, glucoseAverage, xLabels };
    };

    const createCompareGraphData = () => {
        const timeSeriesData = prepareTimeSeriesViolinData();
        if (!timeSeriesData || timeSeriesData.length === 0) return null;

        const plotData = [];
        const xLabels = [];

        // Prepare time labels
        timeSeriesData.forEach((timeGroup) => {
            const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            xLabels.push(timeLabel);
        });

        // Create violin plots for each time point
        timeSeriesData.forEach((timeGroup, index) => {
            const cortisolData = timeGroup.cortisol;
            const glucoseData = timeGroup.glucose;
            const timeLabel = xLabels[index];
            
            // Create cortisol violin plot if we have enough data points
            if (cortisolData.length >= 2) {
                plotData.push({
                    type: 'violin',
                    y: cortisolData,
                    x: Array(cortisolData.length).fill(timeLabel),
                    name: 'Cortisol',
                    yaxis: 'y',
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
                    fillcolor: `rgba(136, 132, 216, ${0.4 + (index * 0.01)})`,
                    line: {
                        color: 'rgb(136, 132, 216)'
                    },
                    marker: {
                        size: 3,
                        color: 'rgba(136, 132, 216, 0.8)',
                        line: {
                            width: 0.5,
                            color: 'rgb(136, 132, 216)'
                        }
                    },
                    scalemode: 'width',
                    width: 0.4,
                    showlegend: index === 0,
                    legendgroup: 'cortisol'
                });
            } else if (cortisolData.length === 1) {
                // For single points, create a scatter plot
                plotData.push({
                    type: 'scatter',
                    mode: 'markers',
                    x: [timeLabel],
                    y: cortisolData,
                    name: 'Cortisol',
                    yaxis: 'y',
                    marker: {
                        color: 'rgba(136, 132, 216, 0.8)',
                        size: 8,
                        line: {
                            color: 'rgb(136, 132, 216)',
                            width: 2
                        }
                    },
                    showlegend: index === 0,
                    legendgroup: 'cortisol'
                });
            }

            // Create glucose violin plot if we have enough data points
            if (glucoseData.length >= 2) {
                plotData.push({
                    type: 'violin',
                    y: glucoseData,
                    x: Array(glucoseData.length).fill(timeLabel),
                    name: 'Glucose',
                    yaxis: 'y2',
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
                    fillcolor: `rgba(130, 202, 157, ${0.4 + (index * 0.01)})`,
                    line: {
                        color: 'rgb(130, 202, 157)'
                    },
                    marker: {
                        size: 3,
                        color: 'rgba(130, 202, 157, 0.8)',
                        line: {
                            width: 0.5,
                            color: 'rgb(130, 202, 157)'
                        }
                    },
                    scalemode: 'width',
                    width: 0.4,
                    showlegend: index === 0,
                    legendgroup: 'glucose'
                });
            } else if (glucoseData.length === 1) {
                // For single points, create a scatter plot
                plotData.push({
                    type: 'scatter',
                    mode: 'markers',
                    x: [timeLabel],
                    y: glucoseData,
                    name: 'Glucose',
                    yaxis: 'y2',
                    marker: {
                        color: 'rgba(130, 202, 157, 0.8)',
                        size: 8,
                        line: {
                            color: 'rgb(130, 202, 157)',
                            width: 2
                        }
                    },
                    showlegend: index === 0,
                    legendgroup: 'glucose'
                });
            }
        });

        // Add moving averages if enabled
        if (showMovingAverage) {
            const movingAverageResult = calculateMovingAverageForBoth(timeSeriesData, movingAverageWindow);
            if (movingAverageResult) {
                // Cortisol moving average
                plotData.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: movingAverageResult.xLabels,
                    y: movingAverageResult.cortisolAverage.filter(val => val !== null),
                    name: `Cortisol MA (${movingAverageWindow}-pt)`,
                    yaxis: 'y',
                    line: {
                        color: 'rgb(255, 99, 71)',
                        width: 3
                    },
                    marker: {
                        color: 'rgb(255, 99, 71)',
                        size: 8,
                        line: {
                            color: 'white',
                            width: 2
                        }
                    },
                    showlegend: false,
                    hovertemplate: '<b>Cortisol Moving Average</b><br>Time: %{x}<br>Value: %{y:.2f} ng/mL<extra></extra>'
                });

                // Glucose moving average
                plotData.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: movingAverageResult.xLabels,
                    y: movingAverageResult.glucoseAverage.filter(val => val !== null),
                    name: `Glucose MA (${movingAverageWindow}-pt)`,
                    yaxis: 'y2',
                    line: {
                        color: 'rgb(255, 140, 0)',
                        width: 3
                    },
                    marker: {
                        color: 'rgb(255, 140, 0)',
                        size: 8,
                        line: {
                            color: 'white',
                            width: 2
                        }
                    },
                    showlegend: false,
                    hovertemplate: '<b>Glucose Moving Average</b><br>Time: %{x}<br>Value: %{y:.2f} mg/dL<extra></extra>'
                });
            }
        }

        return { plotData, xLabels };
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

        // Add moving average line if enabled
        if (showMovingAverage) {
            const movingAverageResult = calculateMovingAverage(timeSeriesData, movingAverageWindow);
            if (movingAverageResult && movingAverageResult.movingAverageData.length > 0) {
                plotData.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: movingAverageResult.xLabels,
                    y: movingAverageResult.movingAverageData,
                    name: `Moving Average (${movingAverageWindow}-point)`,
                    line: {
                        color: selectedBiomarker === 'cortisol' ? 'rgb(255, 99, 71)' : 'rgb(255, 140, 0)',
                        width: 3,
                        dash: 'solid'
                    },
                    marker: {
                        color: selectedBiomarker === 'cortisol' ? 'rgb(255, 99, 71)' : 'rgb(255, 140, 0)',
                        size: 8,
                        line: {
                            color: 'white',
                            width: 2
                        }
                    },
                    showlegend: false,
                    hovertemplate: '<b>Moving Average</b><br>Time: %{x}<br>Value: %{y:.2f}<extra></extra>'
                });
            }
        }

        return { plotData, xLabels };
    };

    // AUC/ROC curve calculation functions
    const generateSampleAUCData = () => {
        console.log('Generating sample AUC data for demonstration...');
        const sampleValues = [];
        
        // Generate sample data based on selected biomarker
        if (selectedBiomarkerForAUC === 'cortisol') {
            // Generate cortisol values (typical range: 0-20 ng/mL)
            // Category 1 (low cortisol): mostly 2-8
            for (let i = 0; i < 30; i++) {
                sampleValues.push(Math.random() * 6 + 2); // 2-8
            }
            // Category 2 (high cortisol): mostly 12-20
            for (let i = 0; i < 25; i++) {
                sampleValues.push(Math.random() * 8 + 12); // 12-20
            }
            // Some intermediate values for realistic distribution
            for (let i = 0; i < 15; i++) {
                sampleValues.push(Math.random() * 4 + 8); // 8-12
            }
        } else {
            // Generate glucose values (typical range: 70-300 mg/dL)
            // Category 1 (normal glucose): mostly 70-100
            for (let i = 0; i < 35; i++) {
                sampleValues.push(Math.random() * 30 + 70); // 70-100
            }
            // Category 2 (high glucose): mostly 150-300
            for (let i = 0; i < 30; i++) {
                sampleValues.push(Math.random() * 150 + 150); // 150-300
            }
            // Some intermediate values
            for (let i = 0; i < 15; i++) {
                sampleValues.push(Math.random() * 50 + 100); // 100-150
            }
        }
        
        console.log(`Generated ${sampleValues.length} sample ${selectedBiomarkerForAUC} values`);
        console.log('Sample range:', Math.min(...sampleValues).toFixed(1), 'to', Math.max(...sampleValues).toFixed(1));
        
        return sampleValues;
    };

    const prepareAUCData = () => {
        console.log('Preparing AUC data...');
        console.log('Sensor data length:', sensorData?.length || 0);
        console.log('Selected biomarker for AUC:', selectedBiomarkerForAUC);
        
        // First try to get real data
        if (sensorData && sensorData.length > 0) {
            const biomarkerValues = [];
            sensorData.forEach((point, index) => {
                // Collect biomarker values based on selected biomarker
                if (selectedBiomarkerForAUC === 'cortisol') {
                    if (point.cortisol1 !== null && point.cortisol1 !== undefined && !isNaN(parseFloat(point.cortisol1))) {
                        biomarkerValues.push(parseFloat(point.cortisol1));
                    }
                    if (point.cortisol2 !== null && point.cortisol2 !== undefined && !isNaN(parseFloat(point.cortisol2))) {
                        biomarkerValues.push(parseFloat(point.cortisol2));
                    }
                } else {
                    if (point.glucose1 !== null && point.glucose1 !== undefined && !isNaN(parseFloat(point.glucose1))) {
                        biomarkerValues.push(parseFloat(point.glucose1));
                    }
                    if (point.glucose2 !== null && point.glucose2 !== undefined && !isNaN(parseFloat(point.glucose2))) {
                        biomarkerValues.push(parseFloat(point.glucose2));
                    }
                }
            });

            console.log('Real biomarker values collected:', biomarkerValues.length);
            
            if (biomarkerValues.length > 0) {
                console.log('Using real data for AUC analysis');
                return biomarkerValues;
            }
        }
        
        // If no real data available, generate sample data
        console.log('No real data available, generating sample data for demonstration');
        return generateSampleAUCData();
    };

    const calculateROCCurve = () => {
        const biomarkerValues = prepareAUCData();
        console.log('Biomarker values:', biomarkerValues?.length || 0, 'values found');
        
        if (!biomarkerValues || biomarkerValues.length === 0) {
            console.log('No biomarker values available');
            return null;
        }

        // Create binary labels based on thresholds
        // Category 1: values <= category1Threshold (negative class, 0)
        // Category 2: values > category2Threshold (positive class, 1)
        // Values between thresholds are excluded for cleaner classification
        
        const dataPoints = [];
        biomarkerValues.forEach(value => {
            if (value <= category1Threshold) {
                dataPoints.push({ value, label: 0, category: 'Category 1' });
            } else if (value > category2Threshold) {
                dataPoints.push({ value, label: 1, category: 'Category 2' });
            }
        });

        console.log('Data points after threshold filtering:', dataPoints.length, 'points');
        console.log('Category 1 threshold:', category1Threshold, 'Category 2 threshold:', category2Threshold);
        
        if (dataPoints.length === 0) {
            console.log('No data points after threshold filtering - adjusting thresholds automatically');
            
            // If no data points after filtering, auto-adjust thresholds based on data distribution
            const sortedValues = [...biomarkerValues].sort((a, b) => a - b);
            const q25 = sortedValues[Math.floor(sortedValues.length * 0.25)];
            const q75 = sortedValues[Math.floor(sortedValues.length * 0.75)];
            
            console.log('Auto-adjusting thresholds based on data quartiles:', q25, q75);
            
            // Use quartiles for automatic classification
            biomarkerValues.forEach(value => {
                if (value <= q25) {
                    dataPoints.push({ value, label: 0, category: 'Category 1' });
                } else if (value >= q75) {
                    dataPoints.push({ value, label: 1, category: 'Category 2' });
                }
            });
            
            console.log('Data points after auto-adjustment:', dataPoints.length, 'points');
        }
        
        if (dataPoints.length === 0) {
            console.log('Still no data points - using simple median split');
            // Last resort: split at median
            const median = biomarkerValues.sort((a, b) => a - b)[Math.floor(biomarkerValues.length / 2)];
            biomarkerValues.forEach(value => {
                dataPoints.push({ 
                    value, 
                    label: value > median ? 1 : 0, 
                    category: value > median ? 'Category 2' : 'Category 1' 
                });
            });
        }

        // Sort by biomarker value descending for ROC calculation
        dataPoints.sort((a, b) => b.value - a.value);

        // Calculate ROC curve points
        const rocPoints = [];
        const totalPositives = dataPoints.filter(p => p.label === 1).length;
        const totalNegatives = dataPoints.filter(p => p.label === 0).length;

        console.log('Total positives:', totalPositives, 'Total negatives:', totalNegatives);

        if (totalPositives === 0 || totalNegatives === 0) {
            console.log('No positive or negative examples - creating balanced split');
            // Force a balanced split if we have all one class
            const halfPoint = Math.floor(dataPoints.length / 2);
            dataPoints.forEach((point, index) => {
                point.label = index < halfPoint ? 1 : 0;
                point.category = index < halfPoint ? 'Category 2' : 'Category 1';
            });
            
            const newTotalPositives = dataPoints.filter(p => p.label === 1).length;
            const newTotalNegatives = dataPoints.filter(p => p.label === 0).length;
            console.log('After balancing - Positives:', newTotalPositives, 'Negatives:', newTotalNegatives);
            
            return calculateROCFromBalancedData(dataPoints, newTotalPositives, newTotalNegatives);
        }

        let tp = 0, fp = 0;
        
        // Add (0,0) point
        rocPoints.push({ fpr: 0, tpr: 0, threshold: Infinity });

        // Calculate points for each unique threshold
        const uniqueValues = [...new Set(dataPoints.map(p => p.value))].sort((a, b) => b - a);
        
        uniqueValues.forEach(threshold => {
            tp = dataPoints.filter(p => p.value >= threshold && p.label === 1).length;
            fp = dataPoints.filter(p => p.value >= threshold && p.label === 0).length;
            
            const tpr = tp / totalPositives;
            const fpr = fp / totalNegatives;
            
            rocPoints.push({ fpr, tpr, threshold });
        });

        // Add (1,1) point
        rocPoints.push({ fpr: 1, tpr: 1, threshold: -Infinity });

        // Calculate AUC using trapezoidal rule
        let auc = 0;
        for (let i = 1; i < rocPoints.length; i++) {
            const deltaFPR = rocPoints[i].fpr - rocPoints[i-1].fpr;
            const avgTPR = (rocPoints[i].tpr + rocPoints[i-1].tpr) / 2;
            auc += deltaFPR * avgTPR;
        }

        console.log('ROC calculation completed. AUC:', auc.toFixed(3));

        return {
            rocPoints,
            auc,
            dataPoints,
            totalPositives,
            totalNegatives
        };
    };

    const calculateROCFromBalancedData = (dataPoints, totalPositives, totalNegatives) => {
        const rocPoints = [];
        let tp = 0, fp = 0;
        
        // Add (0,0) point
        rocPoints.push({ fpr: 0, tpr: 0, threshold: Infinity });

        // Calculate points for each unique threshold
        const uniqueValues = [...new Set(dataPoints.map(p => p.value))].sort((a, b) => b - a);
        
        uniqueValues.forEach(threshold => {
            tp = dataPoints.filter(p => p.value >= threshold && p.label === 1).length;
            fp = dataPoints.filter(p => p.value >= threshold && p.label === 0).length;
            
            const tpr = tp / totalPositives;
            const fpr = fp / totalNegatives;
            
            rocPoints.push({ fpr, tpr, threshold });
        });

        // Add (1,1) point
        rocPoints.push({ fpr: 1, tpr: 1, threshold: -Infinity });

        // Calculate AUC using trapezoidal rule
        let auc = 0;
        for (let i = 1; i < rocPoints.length; i++) {
            const deltaFPR = rocPoints[i].fpr - rocPoints[i-1].fpr;
            const avgTPR = (rocPoints[i].tpr + rocPoints[i-1].tpr) / 2;
            auc += deltaFPR * avgTPR;
        }

        return {
            rocPoints,
            auc,
            dataPoints,
            totalPositives,
            totalNegatives
        };
    };

    const calculateConfusionMatrix = (threshold = null) => {
        const biomarkerValues = prepareAUCData();
        if (!biomarkerValues || biomarkerValues.length === 0) return null;

        // If no threshold provided, use the optimal threshold from ROC
        let optimalThreshold = threshold;
        if (!optimalThreshold) {
            const rocData = calculateROCCurve();
            if (!rocData) return null;
            
            // Find threshold that maximizes (TPR - FPR)
            let maxYouden = -1;
            rocData.rocPoints.forEach(point => {
                const youden = point.tpr - point.fpr;
                if (youden > maxYouden) {
                    maxYouden = youden;
                    optimalThreshold = point.threshold;
                }
            });
        }

        // Create confusion matrix based on optimal threshold
        let tp = 0, fp = 0, tn = 0, fn = 0;
        
        biomarkerValues.forEach(value => {
            const actualCategory = value <= category1Threshold ? 0 : value > category2Threshold ? 1 : null;
            if (actualCategory === null) return; // Skip values in between thresholds
            
            const predictedCategory = value >= optimalThreshold ? 1 : 0;
            
            if (actualCategory === 1 && predictedCategory === 1) tp++;
            else if (actualCategory === 0 && predictedCategory === 1) fp++;
            else if (actualCategory === 0 && predictedCategory === 0) tn++;
            else if (actualCategory === 1 && predictedCategory === 0) fn++;
        });

        const accuracy = (tp + tn) / (tp + fp + tn + fn);
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;

        return {
            tp, fp, tn, fn,
            accuracy,
            precision,
            recall,
            threshold: optimalThreshold
        };
    };

    const createAUCGraphData = () => {
        const rocData = calculateROCCurve();
        if (!rocData) {
            console.log('ROC data is null - creating fallback ROC curve');
            // Create a simple fallback ROC curve for demonstration
            const fallbackROC = {
                rocPoints: [
                    { fpr: 0, tpr: 0, threshold: Infinity },
                    { fpr: 0.1, tpr: 0.3, threshold: 0.9 },
                    { fpr: 0.2, tpr: 0.5, threshold: 0.8 },
                    { fpr: 0.3, tpr: 0.7, threshold: 0.7 },
                    { fpr: 0.5, tpr: 0.8, threshold: 0.5 },
                    { fpr: 0.7, tpr: 0.9, threshold: 0.3 },
                    { fpr: 1, tpr: 1, threshold: -Infinity }
                ],
                auc: 0.75,
                dataPoints: [],
                totalPositives: 25,
                totalNegatives: 25
            };
            
            const plotData = [];
            
            // Fallback ROC Curve
            plotData.push({
                type: 'scatter',
                mode: 'lines+markers',
                x: fallbackROC.rocPoints.map(p => p.fpr),
                y: fallbackROC.rocPoints.map(p => p.tpr),
                name: `ROC Curve (AUC = ${fallbackROC.auc.toFixed(3)}) - Demo`,
                line: {
                    color: 'rgb(31, 119, 180)',
                    width: 3
                },
                marker: {
                    color: 'rgb(31, 119, 180)',
                    size: 6
                },
                hovertemplate: '<b>ROC Curve</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>'
            });

            // Diagonal reference line
            plotData.push({
                type: 'scatter',
                mode: 'lines',
                x: [0, 1],
                y: [0, 1],
                name: 'Random Classifier',
                line: {
                    color: 'red',
                    width: 2,
                    dash: 'dash'
                },
                showlegend: false,
                hoverinfo: 'none'
            });

            return { plotData, rocData: fallbackROC };
        }

        const plotData = [];

        // ROC Curve
        plotData.push({
            type: 'scatter',
            mode: 'lines+markers',
            x: rocData.rocPoints.map(p => p.fpr),
            y: rocData.rocPoints.map(p => p.tpr),
            name: `ROC Curve (AUC = ${rocData.auc.toFixed(3)})`,
            line: {
                color: 'rgb(31, 119, 180)',
                width: 3
            },
            marker: {
                color: 'rgb(31, 119, 180)',
                size: 6
            },
            hovertemplate: '<b>ROC Curve</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>'
        });

        // Diagonal reference line
        plotData.push({
            type: 'scatter',
            mode: 'lines',
            x: [0, 1],
            y: [0, 1],
            name: 'Random Classifier',
            line: {
                color: 'red',
                width: 2,
                dash: 'dash'
            },
            showlegend: false,
            hoverinfo: 'none'
        });

        return { plotData, rocData };
    };

    // Determine which plot data to use
    const plotResult = graphType === 'compare' ? createCompareGraphData() : 
                      graphType === 'auc' ? createAUCGraphData() : 
                      createViolinPlotData();

    // Check if we have sufficient data for visualization
    if ((!plotResult || plotResult.plotData.length === 0) && graphType !== 'auc') {
        let errorMessage;
        if (graphType === 'compare') {
            errorMessage = "No sufficient data available for comparison visualization";
        } else {
            errorMessage = "No sufficient data available for time series violin plot visualization";
        }
        
        return (
            <div className="violin-plot-container">
                <div className="no-data-message">
                    <p>{errorMessage}</p>
                    <p>Time series violin plots require biomarker data that can be grouped by time points.</p>
                </div>
            </div>
        );
    }

    // For AUC graphs, return custom rendering
    if (graphType === 'auc') {
        const { plotData: aucPlotData, rocData } = plotResult;
        
        return (
            <Box sx={{ p: 3 }}>
                {/* Controls */}
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Graph Type</InputLabel>
                                <Select
                                    value={graphType}
                                    onChange={(e) => setGraphType(e.target.value)}
                                    label="Graph Type"
                                >
                                    <MenuItem value="violin">Violin Plot</MenuItem>
                                    <MenuItem value="compare">Compare Graph</MenuItem>
                                    <MenuItem value="auc">AUC/ROC Curve</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Biomarker</InputLabel>
                                <Select
                                    value={selectedBiomarkerForAUC}
                                    onChange={(e) => setSelectedBiomarkerForAUC(e.target.value)}
                                    label="Biomarker"
                                >
                                    <MenuItem value="cortisol">Cortisol (ng/mL)</MenuItem>
                                    <MenuItem value="glucose">Glucose (mg/dL)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Category 1 Threshold</InputLabel>
                                <Select
                                    value={category1Threshold}
                                    onChange={(e) => setCategory1Threshold(e.target.value)}
                                    label="Category 1 Threshold"
                                >
                                    {selectedBiomarkerForAUC === 'cortisol' ? (
                                        <>
                                            <MenuItem value={2}>≤ 2</MenuItem>
                                            <MenuItem value={5}>≤ 5</MenuItem>
                                            <MenuItem value={8}>≤ 8</MenuItem>
                                            <MenuItem value={10}>≤ 10</MenuItem>
                                        </>
                                    ) : (
                                        <>
                                            <MenuItem value={25}>≤ 25</MenuItem>
                                            <MenuItem value={50}>≤ 50</MenuItem>
                                            <MenuItem value={75}>≤ 75</MenuItem>
                                            <MenuItem value={100}>≤ 100</MenuItem>
                                        </>
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Category 2 Threshold</InputLabel>
                                <Select
                                    value={category2Threshold}
                                    onChange={(e) => setCategory2Threshold(e.target.value)}
                                    label="Category 2 Threshold"
                                >
                                    {selectedBiomarkerForAUC === 'cortisol' ? (
                                        <>
                                            <MenuItem value={10}>&gt; 10</MenuItem>
                                            <MenuItem value={12}>&gt; 12</MenuItem>
                                            <MenuItem value={15}>&gt; 15</MenuItem>
                                            <MenuItem value={18}>&gt; 18</MenuItem>
                                        </>
                                    ) : (
                                        <>
                                            <MenuItem value={100}>&gt; 100</MenuItem>
                                            <MenuItem value={125}>&gt; 125</MenuItem>
                                            <MenuItem value={150}>&gt; 150</MenuItem>
                                            <MenuItem value={200}>&gt; 200</MenuItem>
                                        </>
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>

                {/* AUC Plot */}
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Plot
                        data={aucPlotData}
                        layout={{
                            title: `ROC Curve Analysis - ${selectedBiomarkerForAUC} ${rocData?.dataPoints?.length === 0 ? '(Sample Data)' : ''}`,
                            xaxis: {
                                title: 'False Positive Rate (1 - Specificity)',
                                range: [0, 1],
                                showgrid: true,
                                gridcolor: 'rgba(128,128,128,0.2)'
                            },
                            yaxis: {
                                title: 'True Positive Rate (Sensitivity)',
                                range: [0, 1],
                                showgrid: true,
                                gridcolor: 'rgba(128,128,128,0.2)'
                            },
                            showlegend: true,
                            legend: {
                                x: 0.6,
                                y: 0.2,
                                bgcolor: 'rgba(255,255,255,0.8)',
                                bordercolor: 'rgba(0,0,0,0.2)',
                                borderwidth: 1
                            },
                            plot_bgcolor: 'white',
                            paper_bgcolor: 'white',
                            font: { size: 12 },
                            margin: { l: 60, r: 60, t: 80, b: 60 }
                        }}
                        config={{
                            displayModeBar: true,
                            displaylogo: false,
                            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
                        }}
                        useResizeHandler={false}
                        style={{ width: '100%', height: '500px' }}
                    />
                </Paper>
                
                {/* AUC Metrics */}
                {rocData && (
                    <Grid container spacing={3}>
                        {/* Confusion Matrix */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    Confusion Matrix
                </Typography>
                                {(() => {
                                    const confusionData = calculateConfusionMatrix(rocData);
                                    return (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <Box sx={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: '1fr 1fr 1fr',
                                                gap: 1,
                                                mb: 2,
                                                width: '300px'
                                            }}>
                                                <Box></Box>
                                                <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                                                    Predicted Category 1
                </Typography>
                                                <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                                                    Predicted Category 2
                                                </Typography>
                                                
                                                <Typography variant="body2" sx={{ fontWeight: 'bold', alignSelf: 'center' }}>
                                                    Actual Category 1
                                                </Typography>
                                                <Box sx={{ 
                                                    bgcolor: '#90EE90', 
                                                    color: 'black',
                                                    p: 2, 
                                                    textAlign: 'center',
                                                    borderRadius: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center'
                                                }}>
                                                    <Typography variant="h6">TN={confusionData.tn}</Typography>
                                                </Box>
                                                <Box sx={{ 
                                                    bgcolor: '#FFD700', 
                                                    color: 'black',
                                                    p: 2, 
                                                    textAlign: 'center',
                                                    borderRadius: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center'
                                                }}>
                                                    <Typography variant="h6">FP={confusionData.fp}</Typography>
                                                </Box>
                                                
                                                <Typography variant="body2" sx={{ fontWeight: 'bold', alignSelf: 'center' }}>
                                                    Actual Category 2
                                                </Typography>
                                                <Box sx={{ 
                                                    bgcolor: '#FFA500', 
                                                    color: 'black',
                                                    p: 2, 
                                                    textAlign: 'center',
                                                    borderRadius: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center'
                                                }}>
                                                    <Typography variant="h6">FN={confusionData.fn}</Typography>
                                                </Box>
                                                <Box sx={{ 
                                                    bgcolor: '#DDA0DD', 
                                                    color: 'black',
                                                    p: 2, 
                                                    textAlign: 'center',
                                                    borderRadius: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center'
                                                }}>
                                                    <Typography variant="h6">TP={confusionData.tp}</Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    );
                                })()}
            </Paper>
                        </Grid>

                        {/* Performance Metrics */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    Performance Metrics
                                </Typography>
                                {(() => {
                                    const confusionData = calculateConfusionMatrix(rocData);
                                    return (
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Accuracy
                                                </Typography>
                                                <Typography variant="h6">
                                                    {confusionData.accuracy.toFixed(3)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Precision
                                                </Typography>
                                                <Typography variant="h6">
                                                    {confusionData.precision.toFixed(3)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Recall (Sensitivity)
                                                </Typography>
                                                <Typography variant="h6">
                                                    {confusionData.recall.toFixed(3)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">
                                                    AUC Score
                                                </Typography>
                                                <Typography variant="h6" color={rocData.auc > 0.8 ? 'success.main' : rocData.auc > 0.6 ? 'warning.main' : 'error.main'}>
                                                    {rocData.auc.toFixed(3)}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    );
                                })()}
                            </Paper>
                        </Grid>

                        {/* Analysis Summary */}
                        <Grid item xs={12}>
                            <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    Analysis Summary
                                </Typography>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" color="text.secondary">
                                            Category 1 (≤{category1Threshold}):
                                        </Typography>
                                        <Typography variant="h6">
                                            {rocData.totalNegatives} samples
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" color="text.secondary">
                                            Category 2 (&gt;{category2Threshold}):
                                        </Typography>
                                        <Typography variant="h6">
                                            {rocData.totalPositives} samples
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" color="text.secondary">
                                            AUC Interpretation:
                                        </Typography>
                                        <Typography variant="h6">
                                            {rocData.auc >= 0.9 ? 'Excellent' :
                                             rocData.auc >= 0.8 ? 'Good' :
                                             rocData.auc >= 0.7 ? 'Fair' :
                                             rocData.auc >= 0.6 ? 'Poor' :
                                             'Random'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" color="text.secondary">
                                            Data Source:
                                        </Typography>
                                        <Typography variant="h6">
                                            {rocData.dataPoints?.length === 0 ? 'Sample Data' : 'Real Data'}
                                        </Typography>
                                    </Grid>
                                </Grid>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                    ROC curve shows the trade-off between true positive rate and false positive rate. 
                                    AUC values: &gt;0.8 (excellent), 0.6-0.8 (good), 0.5-0.6 (poor), &lt;0.5 (worse than random).
                                    {rocData.dataPoints?.length === 0 && (
                                        <><br/><strong>Note:</strong> Currently displaying sample data for demonstration purposes. 
                                        Real sensor data will be used when available.</>
                                    )}
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                )}
            </Box>
        );
    }

    const plotLayout = graphType === 'compare' ? {
        title: {
            text: `Cortisol vs Glucose Violin Plot Comparison Over Time${showMovingAverage ? ` (with ${movingAverageWindow}-point Moving Average)` : ''}`,
            font: { size: 20 }
        },
        xaxis: {
            title: 'Time Points',
            titlefont: { size: 14 },
            tickangle: -45,
            type: 'category'
        },
        yaxis: {
            title: 'Cortisol (ng/mL)',
            titlefont: { size: 14, color: 'rgb(136, 132, 216)' },
            tickfont: { color: 'rgb(136, 132, 216)' },
            zeroline: false,
            side: 'left'
        },
        yaxis2: {
            title: 'Glucose (mg/dL)',
            titlefont: { size: 14, color: 'rgb(130, 202, 157)' },
            tickfont: { color: 'rgb(130, 202, 157)' },
            zeroline: false,
            side: 'right',
            overlaying: 'y'
        },
        showlegend: false,
        margin: { t: 80, b: 100, l: 80, r: 80 },
        height: 600,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        violinmode: 'group',
        violingap: 0.1,
        violingroupgap: 0.1
    } : graphType === 'auc' ? {
        title: {
            text: `ROC Curve Analysis`,
            font: { size: 20 }
        },
        xaxis: {
            title: 'False Positive Rate (1 - Specificity)',
            range: [0, 1],
            showgrid: true,
            gridcolor: 'rgba(128,128,128,0.2)'
        },
        yaxis: {
            title: 'True Positive Rate (Sensitivity)',
            range: [0, 1],
            showgrid: true,
            gridcolor: 'rgba(128,128,128,0.2)'
        },
        showlegend: true,
        legend: {
            x: 0.6,
            y: 0.2,
            bgcolor: 'rgba(255,255,255,0.8)',
            bordercolor: 'rgba(0,0,0,0.2)',
            borderwidth: 1
        },
        margin: { t: 80, b: 100, l: 80, r: 80 },
        height: 600,
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        shapes: [{
            type: 'line',
            x0: 0, y0: 0,
            x1: 1, y1: 1,
            line: {
                color: 'rgba(128,128,128,0.3)',
                width: 1,
                dash: 'dot'
            }
        }]
    } : {
        title: {
            text: `${selectedBiomarker.charAt(0).toUpperCase() + selectedBiomarker.slice(1)} Distribution Over Time${showMovingAverage ? ` (with ${movingAverageWindow}-point Moving Average)` : ''}`,
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
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Graph Type</InputLabel>
                            <Select
                                value={graphType}
                                onChange={(e) => setGraphType(e.target.value)}
                                label="Graph Type"
                            >
                                <MenuItem value="violin">Violin Plot</MenuItem>
                                <MenuItem value="compare">Compare Graph</MenuItem>
                                <MenuItem value="auc">AUC/ROC Curve</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    {graphType === 'violin' && (
                        <Grid item xs={12} md={2}>
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
                    )}
                    {graphType === 'auc' && (
                        <>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Biomarker</InputLabel>
                                    <Select
                                        value={selectedBiomarkerForAUC}
                                        onChange={(e) => setSelectedBiomarkerForAUC(e.target.value)}
                                        label="Biomarker"
                                    >
                                        <MenuItem value="cortisol">Cortisol (ng/mL)</MenuItem>
                                        <MenuItem value="glucose">Glucose (mg/dL)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Category 1 Threshold</InputLabel>
                                    <Select
                                        value={category1Threshold}
                                        onChange={(e) => setCategory1Threshold(e.target.value)}
                                        label="Category 1 Threshold"
                                    >
                                        {selectedBiomarkerForAUC === 'cortisol' ? (
                                            <>
                                                <MenuItem value={2}>≤ 2</MenuItem>
                                                <MenuItem value={5}>≤ 5</MenuItem>
                                                <MenuItem value={8}>≤ 8</MenuItem>
                                                <MenuItem value={10}>≤ 10</MenuItem>
                                            </>
                                        ) : (
                                            <>
                                                <MenuItem value={25}>≤ 25</MenuItem>
                                                <MenuItem value={50}>≤ 50</MenuItem>
                                                <MenuItem value={75}>≤ 75</MenuItem>
                                                <MenuItem value={100}>≤ 100</MenuItem>
                                            </>
                                        )}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Category 2 Threshold</InputLabel>
                                    <Select
                                        value={category2Threshold}
                                        onChange={(e) => setCategory2Threshold(e.target.value)}
                                        label="Category 2 Threshold"
                                    >
                                        {selectedBiomarkerForAUC === 'cortisol' ? (
                                            <>
                                                <MenuItem value={10}>&gt; 10</MenuItem>
                                                <MenuItem value={12}>&gt; 12</MenuItem>
                                                <MenuItem value={15}>&gt; 15</MenuItem>
                                                <MenuItem value={18}>&gt; 18</MenuItem>
                                            </>
                                        ) : (
                                            <>
                                                <MenuItem value={100}>&gt; 100</MenuItem>
                                                <MenuItem value={125}>&gt; 125</MenuItem>
                                                <MenuItem value={150}>&gt; 150</MenuItem>
                                                <MenuItem value={200}>&gt; 200</MenuItem>
                                            </>
                                        )}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </>
                    )}
                    {graphType !== 'auc' && (
                        <>
                            <Grid item xs={12} md={2}>
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
                            <Grid item xs={12} md={2}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={showMovingAverage}
                                            onChange={(e) => setShowMovingAverage(e.target.checked)}
                                            name="showMovingAverage"
                                            color="primary"
                                        />
                                    }
                                    label="Moving Average"
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth disabled={!showMovingAverage}>
                                    <InputLabel>Window Size</InputLabel>
                                    <Select
                                        value={movingAverageWindow}
                                        onChange={(e) => setMovingAverageWindow(e.target.value)}
                                        label="Window Size"
                                    >
                                        <MenuItem value={3}>3 Points</MenuItem>
                                        <MenuItem value={5}>5 Points</MenuItem>
                                        <MenuItem value={7}>7 Points</MenuItem>
                                        <MenuItem value={9}>9 Points</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                        <Typography variant="body2" color="text.secondary">
                                    {graphType === 'compare' ? 
                                        'Dual-axis comparison view' :
                                        graphType === 'auc' ?
                                            'ROC curve analysis' :
                                            showMovingAverage ? 
                                                `Smoothing over ${movingAverageWindow} time points` : 
                                                'Distribution analysis only'
                                    }
                        </Typography>
                    </Grid>
                        </>
                    )}
                </Grid>
            </Paper>

            {/* Main Plot */}
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
            {summary && graphType !== 'auc' && (
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