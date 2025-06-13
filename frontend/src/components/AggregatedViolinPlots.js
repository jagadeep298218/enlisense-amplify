import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import {
    Container,
    Paper,
    Typography,
    Box,
    CircularProgress,
    Alert,
    AppBar,
    Toolbar,
    IconButton,
    Grid,
    Card,
    CardContent,
    TextField,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Button,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    OutlinedInput,
    ListItemText,
    Switch,
    FormControlLabel,
    Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';

const AggregatedViolinPlots = () => {
    const [aggregatedData, setAggregatedData] = useState({
        cortisol: [],
        glucose: []
    });
    const [filteredData, setFilteredData] = useState([]);
    const [plotData, setPlotData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userCount, setUserCount] = useState(0);
    const [filteredUserCount, setFilteredUserCount] = useState(0);
    const [user, setUser] = useState(null);
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [selectedBiomarker, setSelectedBiomarker] = useState('cortisol');
    const [maxTimePoints, setMaxTimePoints] = useState(20);
    const [showMovingAverage, setShowMovingAverage] = useState(true);
    const [movingAverageWindow, setMovingAverageWindow] = useState(3);
    const [graphType, setGraphType] = useState('violin'); // 'violin' or 'compare'
    
    // Filter states
    const [filters, setFilters] = useState({
        userIDs: [],
        deviceIDs: [],
        genders: [],
        ageMin: '',
        ageMax: '',
        arms: [],
        startDate: '',
        endDate: ''
    });
    
    // Local state for age inputs (to avoid API calls on every keystroke)
    const [localAgeInputs, setLocalAgeInputs] = useState({
        ageMin: '',
        ageMax: ''
    });
    

    
    // Available filter options (populated from data)
    const [filterOptions, setFilterOptions] = useState({
        userIDs: [],
        deviceIDs: [],
        genders: [],
        arms: []
    });
    
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        fetchFilterOptions();
    }, [navigate]);

    // Trigger server-side filtering when filters change
    useEffect(() => {
        fetchFilteredData();
    }, [filters]);

    // Update plot data when filteredData, graphType, or other plot parameters change
    useEffect(() => {
        updatePlotData();
    }, [filteredData, graphType, selectedBiomarker, maxTimePoints, showMovingAverage, movingAverageWindow]);

    // Separate function to fetch available filter options
    const fetchFilterOptions = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/');
                return;
            }

            // Get filter options from server
            const response = await axios.get('http://localhost:3000/aggregated-data/filter-options', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const options = response.data;
            setFilterOptions(options);
            setUserCount(options.totalUsers || 0);
            
            // Initial data load with no filters
            fetchFilteredData();
            
        } catch (error) {
            console.error('Error fetching filter options:', error);
            setError('Failed to fetch filter options: ' + (error.response?.data?.error || error.message));
            setLoading(false);
        }
    };

    // Fetch filtered data from server
    const fetchFilteredData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/');
                return;
            }

            // Build query parameters from filters
            const queryParams = new URLSearchParams();
            
            // Add array filters
            if (filters.userIDs.length > 0) {
                queryParams.append('userIDs', filters.userIDs.join(','));
            }
            if (filters.deviceIDs.length > 0) {
                queryParams.append('deviceIDs', filters.deviceIDs.join(','));
            }
            if (filters.genders.length > 0) {
                queryParams.append('genders', filters.genders.join(','));
            }
            if (filters.arms.length > 0) {
                queryParams.append('arms', filters.arms.join(','));
            }

            // Add range filters
            if (filters.ageMin !== '') {
                queryParams.append('ageMin', filters.ageMin);
            }
            if (filters.ageMax !== '') {
                queryParams.append('ageMax', filters.ageMax);
            }

            // Add date filters
            if (filters.startDate !== '') {
                queryParams.append('startDate', filters.startDate);
            }
            if (filters.endDate !== '') {
                queryParams.append('endDate', filters.endDate);
            }

            // Fetch filtered data from server
            const response = await axios.get(`http://localhost:3000/aggregated-data/filtered?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = response.data;
            setFilteredData(data.data || []);
            setFilteredUserCount(data.uniqueUsers || 0);

            // Process aggregated data for the summary cards
            const cortisolData = (data.data || [])
                .filter(item => item.biomarkerType === 'cortisol')
                .map(item => item.value);
            
            const glucoseData = (data.data || [])
                .filter(item => item.biomarkerType === 'glucose')
                .map(item => item.value);

            setAggregatedData({
                cortisol: cortisolData,
                glucose: glucoseData
            });

            setLoading(false);
        } catch (error) {
            console.error('Error fetching filtered data:', error);
            setError('Failed to fetch filtered data: ' + (error.response?.data?.error || error.message));
            setLoading(false);
        }
    };

    // Update plot data
    const updatePlotData = async () => {
        if (!filteredData || filteredData.length === 0) {
            setPlotData(null);
            return;
        }

        try {
            const result = graphType === 'compare' ? 
                await createCompareGraphData() : 
                await createTimeSeriesViolinPlotData();
            setPlotData(result);
        } catch (error) {
            console.error('Error updating plot data:', error);
            setPlotData(null);
        }
    };

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
    };


    
    // Handle age input changes (local state only, no API call)
    const handleAgeInputChange = (field, value) => {
        setLocalAgeInputs(prev => ({
            ...prev,
            [field]: value
        }));
    };
    
    // Handle Enter key press on age inputs (triggers API call)
    const handleAgeInputEnter = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };
    
    // Handle age input key press
    const handleAgeKeyPress = (event, field, value) => {
        if (event.key === 'Enter') {
            handleAgeInputEnter(field, value);
        }
    };
    
    // Handle age input blur (also triggers API call when user clicks away)
    const handleAgeInputBlur = (field, value) => {
        // Only update if the value has actually changed
        if (filters[field] !== value) {
            handleAgeInputEnter(field, value);
        }
    };
    


    const clearAllFilters = () => {
        setFilters({
            userIDs: [],
            deviceIDs: [],
            genders: [],
            ageMin: '',
            ageMax: '',
            arms: [],
            startDate: '',
            endDate: ''
        });
        setLocalAgeInputs({
            ageMin: '',
            ageMax: ''
        });
    };

    const getActiveFiltersCount = () => {
        let count = 0;
        if (filters.userIDs.length > 0) count++;
        if (filters.deviceIDs.length > 0) count++;
        if (filters.genders.length > 0) count++;
        if (filters.ageMin !== '' || filters.ageMax !== '') count++;
        if (filters.arms.length > 0) count++;
        if (filters.startDate !== '' || filters.endDate !== '') count++;
        return count;
    };

    const handleBack = () => {
        navigate('/');
    };

    const getUserTypeDisplay = () => {
        if (!user) return 'User';
        if (user.admin) return 'Administrator';
        if (user.doctor) return 'Doctor';
        return 'User';
    };



    const prepareTimeSeriesViolinData = async () => {
        if (!filteredData || filteredData.length === 0) return null;

        const timeGroups = {};
        
        filteredData.forEach(item => {
            if (item.biomarkerType !== selectedBiomarker) return;
            
            const timestamp = item.timestamp;
            if (!timestamp) return;
            
            const timeKey = new Date(timestamp).toISOString();
            
            if (!timeGroups[timeKey]) {
                timeGroups[timeKey] = {
                    timestamp: timestamp,
                    values: []
                };
            }
            
            timeGroups[timeKey].values.push(item.value);
        });

        // Sort all time groups
        const allTimeGroups = Object.values(timeGroups)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Apply time point limit (if not "All Time Points")
        const limitedTimeGroups = maxTimePoints === -1 ? allTimeGroups : allTimeGroups.slice(0, maxTimePoints);

        return limitedTimeGroups;
    };

    // Prepare data for compare graph (includes both cortisol and glucose)
    const prepareCompareGraphData = async () => {
        if (!filteredData || filteredData.length === 0) return null;

        const timeGroups = {};
        
        filteredData.forEach(item => {
            // Include both cortisol and glucose for compare graph
            if (item.biomarkerType !== 'cortisol' && item.biomarkerType !== 'glucose') return;
            
            const timestamp = item.timestamp;
            if (!timestamp) return;
            
            const timeKey = new Date(timestamp).toISOString();
            
            if (!timeGroups[timeKey]) {
                timeGroups[timeKey] = {
                    timestamp: timestamp,
                    values: []
                };
            }
            
            // Store the full item with biomarkerType for filtering later
            timeGroups[timeKey].values.push({
                value: item.value,
                biomarkerType: item.biomarkerType
            });
        });

        // Sort all time groups
        const allTimeGroups = Object.values(timeGroups)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Apply time point limit (if not "All Time Points")
        const limitedTimeGroups = maxTimePoints === -1 ? allTimeGroups : allTimeGroups.slice(0, maxTimePoints);

        return limitedTimeGroups;
    };

    // Calculate moving average for both biomarkers (for compare graph)
    const calculateMovingAverageForBoth = (timeSeriesData, windowSize) => {
        if (!timeSeriesData || timeSeriesData.length === 0) return null;
        
        const cortisolAverage = [];
        const glucoseAverage = [];
        const xLabels = [];
        
        timeSeriesData.forEach((timeGroup, index) => {
            const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            xLabels.push(timeLabel);
            
            // Calculate cortisol moving average
            const cortisolData = timeGroup.values.filter(val => val.biomarkerType === 'cortisol').map(v => v.value);
            if (cortisolData.length > 0) {
                const cortisolMean = cortisolData.reduce((sum, val) => sum + val, 0) / cortisolData.length;
                let startIndex = Math.max(0, index - Math.floor(windowSize / 2));
                let endIndex = Math.min(timeSeriesData.length - 1, index + Math.floor(windowSize / 2));
                
                let windowValues = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    const windowCortisol = timeSeriesData[i].values.filter(val => val.biomarkerType === 'cortisol').map(v => v.value);
                    if (windowCortisol.length > 0) {
                        const windowMean = windowCortisol.reduce((sum, val) => sum + val, 0) / windowCortisol.length;
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
            const glucoseData = timeGroup.values.filter(val => val.biomarkerType === 'glucose').map(v => v.value);
            if (glucoseData.length > 0) {
                const glucoseMean = glucoseData.reduce((sum, val) => sum + val, 0) / glucoseData.length;
                let startIndex = Math.max(0, index - Math.floor(windowSize / 2));
                let endIndex = Math.min(timeSeriesData.length - 1, index + Math.floor(windowSize / 2));
                
                let windowValues = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    const windowGlucose = timeSeriesData[i].values.filter(val => val.biomarkerType === 'glucose').map(v => v.value);
                    if (windowGlucose.length > 0) {
                        const windowMean = windowGlucose.reduce((sum, val) => sum + val, 0) / windowGlucose.length;
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

    const createCompareGraphData = async () => {
        const timeSeriesData = await prepareCompareGraphData();
        if (!timeSeriesData || timeSeriesData.length === 0) return null;

        const plotData = [];
        const xLabels = new Set();

        // Prepare time labels
        timeSeriesData.forEach((timeGroup) => {
            const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            xLabels.add(timeLabel);
        });

        // Create violin plots for each time point
        timeSeriesData.forEach((timeGroup, index) => {
            const cortisolData = timeGroup.values.filter(val => val.biomarkerType === 'cortisol').map(v => v.value);
            const glucoseData = timeGroup.values.filter(val => val.biomarkerType === 'glucose').map(v => v.value);
            const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
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
                    fillcolor: 'rgba(136, 132, 216, 0.7)',
                    line: {
                        color: 'rgb(136, 132, 216)'
                    },
                    marker: {
                        size: 3,
                        color: 'rgba(136, 132, 216, 0.7)',
                        line: {
                            width: 0.5,
                            color: 'rgb(136, 132, 216)'
                        }
                    },
                    scalemode: 'width',
                    width: 0.3,
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
                        color: 'rgba(136, 132, 216, 0.7)',
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
                    fillcolor: 'rgba(130, 202, 157, 0.7)',
                    line: {
                        color: 'rgb(130, 202, 157)'
                    },
                    marker: {
                        size: 3,
                        color: 'rgba(130, 202, 157, 0.7)',
                        line: {
                            width: 0.5,
                            color: 'rgb(130, 202, 157)'
                        }
                    },
                    scalemode: 'width',
                    width: 0.3,
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
                        color: 'rgba(130, 202, 157, 0.7)',
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
            const movingAverage = calculateMovingAverageForBoth(timeSeriesData, movingAverageWindow);
            if (movingAverage) {
                // Cortisol moving average
                plotData.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: movingAverage.xLabels,
                    y: movingAverage.cortisolAverage.filter(val => val !== null),
                    name: 'Cortisol MA',
                    yaxis: 'y',
                    line: {
                        color: 'rgb(255, 99, 71)',
                        width: 3
                    },
                    marker: {
                        color: 'rgb(255, 99, 71)',
                        size: 6
                    },
                    showlegend: false,
                    hovertemplate: '<b>Cortisol MA</b><br>Time: %{x}<br>Value: %{y:.2f} ng/mL<extra></extra>'
                });

                // Glucose moving average
                plotData.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: movingAverage.xLabels,
                    y: movingAverage.glucoseAverage.filter(val => val !== null),
                    name: 'Glucose MA',
                    yaxis: 'y2',
                    line: {
                        color: 'rgb(255, 140, 0)',
                        width: 3
                    },
                    marker: {
                        color: 'rgb(255, 140, 0)',
                        size: 6
                    },
                    showlegend: false,
                    hovertemplate: '<b>Glucose MA</b><br>Time: %{x}<br>Value: %{y:.2f} mg/dL<extra></extra>'
                });
            }
        }

        return { plotData, xLabels: Array.from(xLabels).sort() };
    };

    // Calculate moving average for the time series data (original function for violin plots)
    const calculateMovingAverage = (timeSeriesData, windowSize) => {
        if (!timeSeriesData || timeSeriesData.length === 0) return null;
        
        const movingAverageData = [];
        const xLabels = [];
        
        timeSeriesData.forEach((timeGroup, index) => {
            const biomarkerData = timeGroup.values;
            
            if (biomarkerData.length > 0) {
                // Calculate the mean of all values at this time point
                const meanValue = biomarkerData.reduce((sum, val) => sum + val, 0) / biomarkerData.length;
                
                // Apply moving average calculation
                let startIndex = Math.max(0, index - Math.floor(windowSize / 2));
                let endIndex = Math.min(timeSeriesData.length - 1, index + Math.floor(windowSize / 2));
                
                // Collect values for moving average window
                let windowValues = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    const windowData = timeSeriesData[i].values;
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

    const createTimeSeriesViolinPlotData = async () => {
        const timeSeriesData = await prepareTimeSeriesViolinData();
        if (!timeSeriesData || timeSeriesData.length === 0) return null;

        const plotData = [];
        const xLabels = new Set();

        // Color scheme
        const colorScheme = {
            fill: selectedBiomarker === 'cortisol' ? 'rgba(136, 132, 216, 0.6)' : 'rgba(130, 202, 157, 0.6)',
            line: selectedBiomarker === 'cortisol' ? 'rgb(136, 132, 216)' : 'rgb(130, 202, 157)',
            marker: selectedBiomarker === 'cortisol' ? 'rgba(136, 132, 216, 0.8)' : 'rgba(130, 202, 157, 0.8)'
        };

        timeSeriesData.forEach((timeGroup, index) => {
            const biomarkerData = timeGroup.values;
            
            // Only create violin if we have at least 2 data points for meaningful distribution
            if (biomarkerData.length >= 2) {
                const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                xLabels.add(timeLabel);
                
                plotData.push({
                    type: 'violin',
                    y: biomarkerData,
                    x: Array(biomarkerData.length).fill(timeLabel),
                    name: timeLabel,
                    side: 'both',
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
                    fillcolor: colorScheme.fill,
                    line: {
                        color: colorScheme.line
                    },
                    marker: {
                        size: 3,
                        color: colorScheme.marker,
                        line: {
                            width: 0.5,
                            color: colorScheme.line
                        }
                    },
                    scalemode: 'width',
                    width: 0.8,
                    showlegend: false
                });
            } else if (biomarkerData.length === 1) {
                // For single points, create a scatter plot instead
                const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                xLabels.add(timeLabel);
                
                plotData.push({
                    type: 'scatter',
                    mode: 'markers',
                    y: biomarkerData,
                    x: [timeLabel],
                    name: timeLabel,
                    marker: {
                        size: 8,
                        color: colorScheme.marker,
                        line: {
                            width: 2,
                            color: colorScheme.line
                        }
                    },
                    showlegend: false
                });
            }
        });

        // Add moving average lines if enabled
        if (showMovingAverage) {
            const movingAverage = calculateMovingAverage(timeSeriesData, movingAverageWindow);
            if (movingAverage && movingAverage.movingAverageData.length > 0) {
                plotData.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: movingAverage.xLabels,
                    y: movingAverage.movingAverageData,
                    name: `Moving Average (${movingAverageWindow}-point)`,
                    line: {
                        color: 'rgb(255, 99, 71)',
                        width: 3,
                        dash: 'solid'
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
                    hovertemplate: '<b>Moving Average</b><br>Time: %{x}<br>Value: %{y:.2f}<extra></extra>'
                });
            }
        }

        return { plotData, xLabels: Array.from(xLabels).sort() };
    };

    const timeSeriesPlotLayout = plotData ? (graphType === 'compare' ? {
        title: {
            text: `Population Cortisol vs Glucose Violin Plot Comparison Over Time${showMovingAverage ? ` (with ${movingAverageWindow}-point Moving Average)` : ''}`,
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
    } : {
        title: {
            text: `Population ${selectedBiomarker.charAt(0).toUpperCase() + selectedBiomarker.slice(1)} Distribution Over Time${showMovingAverage ? ` (with ${movingAverageWindow}-point Moving Average)` : ''}`,
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
    }) : null;

    const timeSeriesPlotConfig = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };

    const getTimeSeriesDataSummary = async () => {
        const timeSeriesData = await prepareTimeSeriesViolinData();
        if (!timeSeriesData) return null;

        const biomarkerCounts = timeSeriesData.map(group => ({
            time: new Date(group.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            count: group.values.length,
            values: group.values
        })).filter(item => item.count > 0);

        const totalReadings = biomarkerCounts.reduce((sum, item) => sum + item.count, 0);
        const avgReadingsPerTime = biomarkerCounts.length > 0 ? totalReadings / biomarkerCounts.length : 0;

        return {
            totalTimePoints: biomarkerCounts.length,
            totalReadings,
            avgReadingsPerTime: avgReadingsPerTime.toFixed(1),
            timePointsWithMultipleReadings: biomarkerCounts.filter(item => item.count > 1).length
        };
    };

    if (loading) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ ml: 2 }}>Loading aggregated data...</Typography>
        </Box>
    );

    if (error) return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            <Box textAlign="center">
                <IconButton onClick={handleBack} sx={{ mt: 2 }}>
                    <ArrowBackIcon />
                    <Typography sx={{ ml: 1 }}>Back to Dashboard</Typography>
                </IconButton>
            </Box>
        </Container>
    );

    return (
        <Container maxWidth={false} sx={{ mb: 4, px: 4 }}>
            <AppBar position="static" color="default" elevation={0}>
                <Toolbar>
                    <IconButton edge="start" onClick={handleBack}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ ml: 2, flexGrow: 1 }}>
                        Population Analysis - {getUserTypeDisplay()} View
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FilterListIcon />
                        <Typography variant="body2">
                            {getActiveFiltersCount()} filters active
                        </Typography>
                    </Box>
                </Toolbar>
            </AppBar>

            <Box sx={{ mt: 3 }}>
                {/* Filter Controls */}
                <Accordion 
                    expanded={filtersExpanded} 
                    onChange={(event, isExpanded) => setFiltersExpanded(isExpanded)}
                    sx={{ mb: 3 }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <FilterListIcon color="primary" />
                            <Typography variant="h6" color="primary">
                                Data Filters
                            </Typography>
                            {getActiveFiltersCount() > 0 && (
                                <Chip 
                                    label={`${getActiveFiltersCount()} active`} 
                                    size="small" 
                                    color="primary" 
                                />
                            )}
                            <Box sx={{ flexGrow: 1 }} />
                            {getActiveFiltersCount() > 0 && (
                                <Button
                                    startIcon={<ClearIcon />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearAllFilters();
                                    }}
                                    size="small"
                                    color="secondary"
                                >
                                    Clear All
                                </Button>
                            )}
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={3}>
                            {/* User ID Filter */}
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel>User IDs</InputLabel>
                                    <Select
                                        multiple
                                        value={filters.userIDs}
                                        onChange={(e) => handleFilterChange('userIDs', e.target.value)}
                                        input={<OutlinedInput label="User IDs" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={value} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {filterOptions.userIDs.map((userID) => (
                                            <MenuItem key={userID} value={userID}>
                                                <Checkbox checked={filters.userIDs.indexOf(userID) > -1} />
                                                <ListItemText primary={userID} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Device ID Filter */}
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Device IDs</InputLabel>
                                    <Select
                                        multiple
                                        value={filters.deviceIDs}
                                        onChange={(e) => handleFilterChange('deviceIDs', e.target.value)}
                                        input={<OutlinedInput label="Device IDs" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={value} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {filterOptions.deviceIDs.map((deviceID) => (
                                            <MenuItem key={deviceID} value={deviceID}>
                                                <Checkbox checked={filters.deviceIDs.indexOf(deviceID) > -1} />
                                                <ListItemText primary={deviceID} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Gender Filter */}
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth>
                                    <InputLabel>Gender</InputLabel>
                                    <Select
                                        multiple
                                        value={filters.genders}
                                        onChange={(e) => handleFilterChange('genders', e.target.value)}
                                        input={<OutlinedInput label="Gender" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={value} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {filterOptions.genders.map((gender) => (
                                            <MenuItem key={gender} value={gender}>
                                                <Checkbox checked={filters.genders.indexOf(gender) > -1} />
                                                <ListItemText primary={gender} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Age Range Filter */}
                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label="Min Age"
                                    placeholder="Press Enter to apply"
                                    value={localAgeInputs.ageMin}
                                    onChange={(e) => handleAgeInputChange('ageMin', e.target.value)}
                                    onKeyPress={(e) => handleAgeKeyPress(e, 'ageMin', localAgeInputs.ageMin)}
                                    onBlur={() => handleAgeInputBlur('ageMin', localAgeInputs.ageMin)}
                                    inputProps={{ min: 0, max: 150 }}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label="Max Age"
                                    placeholder="Press Enter to apply"
                                    value={localAgeInputs.ageMax}
                                    onChange={(e) => handleAgeInputChange('ageMax', e.target.value)}
                                    onKeyPress={(e) => handleAgeKeyPress(e, 'ageMax', localAgeInputs.ageMax)}
                                    onBlur={() => handleAgeInputBlur('ageMax', localAgeInputs.ageMax)}
                                    inputProps={{ min: 0, max: 150 }}
                                />
                            </Grid>

                            {/* Arm Filter */}
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Arm</InputLabel>
                                    <Select
                                        multiple
                                        value={filters.arms}
                                        onChange={(e) => handleFilterChange('arms', e.target.value)}
                                        input={<OutlinedInput label="Arm" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={value} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {filterOptions.arms.map((arm) => (
                                            <MenuItem key={arm} value={arm}>
                                                <Checkbox checked={filters.arms.indexOf(arm) > -1} />
                                                <ListItemText primary={arm} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Date Range Filter */}
                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Start Date"
                                    value={filters.startDate}
                                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="End Date"
                                    value={filters.endDate}
                                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>

                {/* Summary Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="primary">Total Users</Typography>
                                <Typography variant="h4">{userCount}</Typography>
                                <Typography variant="body2" color="text.secondary">All accessible users</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="primary">Filtered Users</Typography>
                                <Typography variant="h4">{filteredUserCount}</Typography>
                                <Typography variant="body2" color="text.secondary">After applying filters</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="primary">Cortisol Readings</Typography>
                                <Typography variant="h4">{aggregatedData.cortisol.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Combined from all sensors</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="primary">Glucose Readings</Typography>
                                <Typography variant="h4">{aggregatedData.glucose.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Combined from all sensors</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {filteredData.length > 0 ? (
                    <>
                        <Typography variant="h5" gutterBottom align="center" color="primary" sx={{ mb: 3 }}>
                            {getActiveFiltersCount() > 0 ? 'Filtered' : 'Population-Level'} Time Series Biomarker Analysis
                        </Typography>
                        
                                                {/* Time Series Controls */}
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
                                        label="Show Moving Average"
                                    />
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <FormControl fullWidth>
                                        <InputLabel>Moving Average Window</InputLabel>
                                        <Select
                                            value={movingAverageWindow}
                                            onChange={(e) => setMovingAverageWindow(e.target.value)}
                                            label="Moving Average Window"
                                        >
                                            <MenuItem value={1}>1 Time Point</MenuItem>
                                            <MenuItem value={3}>3 Time Points</MenuItem>
                                            <MenuItem value={5}>5 Time Points</MenuItem>
                                            <MenuItem value={10}>10 Time Points</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Typography variant="body2" color="text.secondary">
                                        {graphType === 'compare' ? 
                                            'Dual-axis comparison view showing both cortisol and glucose data' :
                                            'Showing population distribution across sensors at each time point'
                                        }
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Paper>



                        {/* Time Series Violin Plot */}
                        {plotData && plotData.plotData.length > 0 ? (
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Plot
                                    data={plotData.plotData}
                                    layout={timeSeriesPlotLayout}
                                    config={timeSeriesPlotConfig}
                                    useResizeHandler={false}
                                    style={{ width: '100%', height: '650px' }}
                                />
                            </Paper>
                        ) : (
                            <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
                                <Typography variant="h6" color="text.secondary">
                                    No sufficient data available for time series violin plot visualization
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Each time point needs multiple sensor readings across the population to create meaningful violin plots.
                                </Typography>
                            </Paper>
                        )}

                        {/* Time Series Summary Statistics */}
                        <TimeSeriesSummary 
                            getTimeSeriesDataSummary={getTimeSeriesDataSummary}
                            selectedBiomarker={selectedBiomarker}
                            showMovingAverage={showMovingAverage}
                            movingAverageWindow={movingAverageWindow}
                        />
                    </>
                ) : (
                    <Paper sx={{ p: 4, mt: 2 }}>
                        <Typography variant="h6" align="center" color="text.secondary">
                            {getActiveFiltersCount() > 0 ? 
                                'No data matches the current filter criteria.' : 
                                'No sensor data available for aggregated analysis.'
                            }
                        </Typography>
                        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                            {getActiveFiltersCount() > 0 ? 
                                'Try adjusting or clearing the filters to see more data.' :
                                'The accessible users don\'t have sensor data available for visualization.'
                            }
                        </Typography>
                    </Paper>
                )}
            </Box>
        </Container>
    );
};

// Separate component for Time Series Summary to handle async data
const TimeSeriesSummary = ({ getTimeSeriesDataSummary, selectedBiomarker, showMovingAverage, movingAverageWindow }) => {
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        const fetchSummary = async () => {
            const summaryData = await getTimeSeriesDataSummary();
            setSummary(summaryData);
        };
        fetchSummary();
    }, [getTimeSeriesDataSummary]);

    if (!summary) return null;

    return (
        <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
            <Typography variant="h6" gutterBottom color="primary">
                Population Time Series Analysis Summary
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
                        Total Population Readings:
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
                Each violin shows the population distribution of {selectedBiomarker} readings from all users and sensors at a specific time point. Single readings are shown as scatter points.
                {showMovingAverage && ` The moving average line (${movingAverageWindow}-point window) smooths the mean values across time points to reveal trends.`}
            </Typography>
        </Paper>
    );
};

export default AggregatedViolinPlots; 