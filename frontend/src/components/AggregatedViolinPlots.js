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
    const [allUsersData, setAllUsersData] = useState([]);
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
        fetchAllUsersData();
    }, [navigate]);

    useEffect(() => {
        applyFiltersAndAggregate();
    }, [filters, allUsersData]);

    const fetchAllUsersData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/');
                return;
            }

            // Get all users the current user has access to
            const fileTrackerResponse = await axios.get('http://localhost:3000/filetracker', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const users = fileTrackerResponse.data;
            setUserCount(users.length);

            if (users.length === 0) {
                setLoading(false);
                return;
            }

            // Collect all data from all accessible users
            const allData = [];
            const uniqueUserIDs = new Set();
            const uniqueDeviceIDs = new Set();
            const uniqueGenders = new Set();
            const uniqueArms = new Set();

            for (const userInfo of users) {
                try {
                    if (userInfo.etag) {
                        const sensorDataResponse = await axios.get(`http://localhost:3000/user-sensor-data/${userInfo.etag}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        const sensorData = sensorDataResponse.data;
                        let dataPoints = [];

                        if (sensorData?.data?.data_points) {
                            dataPoints = sensorData.data.data_points;
                        } else if (sensorData?.data_snapshot?.data_points) {
                            dataPoints = sensorData.data_snapshot.data_points;
                        }

                        // Get device info for this user
                        const deviceInfo = userInfo.device_info || {};
                        
                        // Add to filter options
                        if (deviceInfo.userID) uniqueUserIDs.add(deviceInfo.userID);
                        if (deviceInfo.deviceID) uniqueDeviceIDs.add(deviceInfo.deviceID);
                        if (deviceInfo.gender) uniqueGenders.add(deviceInfo.gender);
                        if (deviceInfo.arm) uniqueArms.add(deviceInfo.arm);

                        // Process each data point
                        dataPoints.forEach(point => {
                            // Parse timestamp
                            let timestamp;
                            try {
                                if (point.timestamp?.$date?.$numberLong) {
                                    timestamp = new Date(parseInt(point.timestamp.$date.$numberLong));
                                } else if (point.timestamp?.$date) {
                                    timestamp = new Date(point.timestamp.$date);
                                } else if (point.timestamp) {
                                    timestamp = new Date(point.timestamp);
                                } else if (point.time) {
                                    const timeValue = point.time?.$numberInt || point.time;
                                    timestamp = new Date(parseInt(timeValue) * 1000);
                                } else {
                                    timestamp = new Date();
                                }
                            } catch (error) {
                                timestamp = new Date();
                            }

                            // Extract sensor values
                            const cortisol1 = point['Cortisol(ng/mL)']?.$numberDouble || point['Cortisol(ng/mL)'];
                            const cortisol2 = point['Cortisol(ng/mL)_2']?.$numberDouble || point['Cortisol(ng/mL)_2'];
                            const glucose1 = point['Glucose(mg/dL)']?.$numberDouble || point['Glucose(mg/dL)'];
                            const glucose2 = point['Glucose(mg/dL)_2']?.$numberDouble || point['Glucose(mg/dL)_2'];

                            // Create data entries
                            const baseEntry = {
                                username: userInfo.username,
                                userID: deviceInfo.userID,
                                deviceID: deviceInfo.deviceID,
                                gender: deviceInfo.gender,
                                age: deviceInfo.age?.$numberInt || deviceInfo.age,
                                arm: deviceInfo.arm,
                                timestamp: timestamp,
                                rawPoint: point
                            };

                            // Add cortisol readings
                            if (cortisol1 !== null && cortisol1 !== undefined && !isNaN(cortisol1)) {
                                allData.push({
                                    ...baseEntry,
                                    biomarkerType: 'cortisol',
                                    value: cortisol1,
                                    sensor: 1
                                });
                            }
                            if (cortisol2 !== null && cortisol2 !== undefined && !isNaN(cortisol2)) {
                                allData.push({
                                    ...baseEntry,
                                    biomarkerType: 'cortisol',
                                    value: cortisol2,
                                    sensor: 2
                                });
                            }

                            // Add glucose readings
                            if (glucose1 !== null && glucose1 !== undefined && !isNaN(glucose1)) {
                                allData.push({
                                    ...baseEntry,
                                    biomarkerType: 'glucose',
                                    value: glucose1,
                                    sensor: 1
                                });
                            }
                            if (glucose2 !== null && glucose2 !== undefined && !isNaN(glucose2)) {
                                allData.push({
                                    ...baseEntry,
                                    biomarkerType: 'glucose',
                                    value: glucose2,
                                    sensor: 2
                                });
                            }
                        });
                    }
                } catch (userError) {
                    console.warn(`Could not fetch data for user ${userInfo.username}:`, userError.message);
                }
            }

            setAllUsersData(allData);
            setFilterOptions({
                userIDs: Array.from(uniqueUserIDs).sort(),
                deviceIDs: Array.from(uniqueDeviceIDs).sort(),
                genders: Array.from(uniqueGenders).sort(),
                arms: Array.from(uniqueArms).sort()
            });

            setLoading(false);
        } catch (error) {
            console.error('Error fetching aggregated data:', error);
            setError('Failed to fetch aggregated sensor data: ' + (error.response?.data?.error || error.message));
            setLoading(false);
        }
    };

    const applyFiltersAndAggregate = () => {
        let filteredData = [...allUsersData];

        // Apply UserID filter
        if (filters.userIDs.length > 0) {
            filteredData = filteredData.filter(item => 
                filters.userIDs.includes(item.userID)
            );
        }

        // Apply DeviceID filter
        if (filters.deviceIDs.length > 0) {
            filteredData = filteredData.filter(item => 
                filters.deviceIDs.includes(item.deviceID)
            );
        }

        // Apply Gender filter
        if (filters.genders.length > 0) {
            filteredData = filteredData.filter(item => 
                filters.genders.includes(item.gender)
            );
        }

        // Apply Age range filter
        if (filters.ageMin !== '' || filters.ageMax !== '') {
            filteredData = filteredData.filter(item => {
                const age = parseInt(item.age);
                if (isNaN(age)) return false;
                
                const minAge = filters.ageMin !== '' ? parseInt(filters.ageMin) : 0;
                const maxAge = filters.ageMax !== '' ? parseInt(filters.ageMax) : 999;
                
                return age >= minAge && age <= maxAge;
            });
        }

        // Apply Arm filter
        if (filters.arms.length > 0) {
            filteredData = filteredData.filter(item => 
                filters.arms.includes(item.arm)
            );
        }

        // Apply Date range filter
        if (filters.startDate !== '' || filters.endDate !== '') {
            filteredData = filteredData.filter(item => {
                const itemDate = item.timestamp;
                const startDate = filters.startDate !== '' ? new Date(filters.startDate) : new Date('1900-01-01');
                const endDate = filters.endDate !== '' ? new Date(filters.endDate + 'T23:59:59') : new Date('2099-12-31');
                
                return itemDate >= startDate && itemDate <= endDate;
            });
        }

        // Aggregate filtered data
        const cortisolData = filteredData
            .filter(item => item.biomarkerType === 'cortisol')
            .map(item => item.value);
        
        const glucoseData = filteredData
            .filter(item => item.biomarkerType === 'glucose')
            .map(item => item.value);

        // Count unique users in filtered data
        const uniqueUsers = new Set(filteredData.map(item => item.username));
        setFilteredUserCount(uniqueUsers.size);

        setAggregatedData({
            cortisol: cortisolData,
            glucose: glucoseData
        });
    };

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
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

    const applyFilters = (data, filterSet) => {
        return data.filter(item => {
            // Apply all filters
            if (filterSet.userIDs.length > 0 && !filterSet.userIDs.includes(item.userID)) return false;
            if (filterSet.deviceIDs.length > 0 && !filterSet.deviceIDs.includes(item.deviceID)) return false;
            if (filterSet.genders.length > 0 && !filterSet.genders.includes(item.gender)) return false;
            if (filterSet.arms.length > 0 && !filterSet.arms.includes(item.arm)) return false;
            
            if (filterSet.ageMin && item.age < parseInt(filterSet.ageMin)) return false;
            if (filterSet.ageMax && item.age > parseInt(filterSet.ageMax)) return false;
            
            if (filterSet.startDate && item.timestamp < new Date(filterSet.startDate)) return false;
            if (filterSet.endDate && item.timestamp > new Date(filterSet.endDate + 'T23:59:59')) return false;
            
            return true;
        });
    };

    const prepareTimeSeriesViolinData = () => {
        if (!allUsersData || allUsersData.length === 0) return null;

        // Filter data based on current filters
        const filteredData = applyFilters(allUsersData, filters);
        
        const processDataGroup = (data) => {
            const timeGroups = {};
            
            data.forEach(item => {
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

            return Object.values(timeGroups);
        };

        // Process main dataset
        const mainData = processDataGroup(filteredData);
        
        // Sort all time groups
        const allTimeGroups = [...mainData]
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Apply time point limit (if not "All Time Points")
        const limitedTimeGroups = maxTimePoints === -1 ? allTimeGroups : allTimeGroups.slice(0, maxTimePoints);

        return { 
            main: limitedTimeGroups
        };
    };

    const calculateMovingAverage = (timeSeriesData, windowSize, datasetName = '') => {
        if (!timeSeriesData || timeSeriesData.length === 0) return null;
        
        const movingAverageData = [];
        const xLabels = [];
        
        timeSeriesData.forEach((timeGroup, index) => {
            const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            xLabels.push(timeLabel);
            
            const biomarkerData = timeGroup.values;
            if (biomarkerData.length > 0) {
                const mean = biomarkerData.reduce((sum, val) => sum + val, 0) / biomarkerData.length;
                let startIndex = Math.max(0, index - Math.floor(windowSize / 2));
                let endIndex = Math.min(timeSeriesData.length - 1, index + Math.floor(windowSize / 2));
                
                let windowValues = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    const windowData = timeSeriesData[i].values;
                    if (windowData.length > 0) {
                        const windowMean = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
                        windowValues.push(windowMean);
                    }
                }
                
                const movingAverage = windowValues.length > 0 ? 
                    windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length : mean;
                movingAverageData.push(movingAverage);
            } else {
                movingAverageData.push(null);
            }
        });
        
        return { movingAverageData, xLabels, datasetName };
    };

    const createTimeSeriesViolinPlotData = () => {
        const timeSeriesData = prepareTimeSeriesViolinData();
        if (!timeSeriesData) return null;

        const plotData = [];
        const xLabels = new Set();

        const processDataset = (dataset, datasetName, colorScheme) => {
            dataset.forEach((timeGroup, index) => {
                const biomarkerData = timeGroup.values;
                if (biomarkerData.length === 0) return;

                const timeLabel = new Date(timeGroup.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                xLabels.add(timeLabel);

                if (biomarkerData.length >= 2) {
                    plotData.push({
                        type: 'violin',
                        y: biomarkerData,
                        x: Array(biomarkerData.length).fill(timeLabel),
                        name: `${timeLabel} - ${datasetName}`,
                        legendgroup: datasetName,
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
                    plotData.push({
                        type: 'scatter',
                        mode: 'markers',
                        x: [timeLabel],
                        y: biomarkerData,
                        name: `${timeLabel} - ${datasetName}`,
                        legendgroup: datasetName,
                        marker: {
                            color: colorScheme.marker,
                            size: 8,
                            line: {
                                color: colorScheme.line,
                                width: 2
                            }
                        },
                        showlegend: false
                    });
                }
            });
        };

        // Process main dataset
        processDataset(timeSeriesData.main, 'Dataset 1', {
            fill: 'rgba(136, 132, 216, 0.7)',
            line: 'rgb(136, 132, 216)',
            marker: 'rgb(136, 132, 216)'
        });

        // Add moving average lines if enabled
        if (showMovingAverage) {
            // Main dataset moving average
            const mainMovingAverage = calculateMovingAverage(timeSeriesData.main, movingAverageWindow, 'Dataset 1');
            if (mainMovingAverage && mainMovingAverage.movingAverageData.length > 0) {
                plotData.push({
                    type: 'scatter',
                    mode: 'lines+markers',
                    x: mainMovingAverage.xLabels,
                    y: mainMovingAverage.movingAverageData,
                    name: `Moving Average - ${mainMovingAverage.datasetName} (${movingAverageWindow}-point)`,
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
                    hovertemplate: '<b>Moving Average - Dataset 1</b><br>Time: %{x}<br>Value: %{y:.2f}<extra></extra>'
                });
            }
        }

        return { plotData, xLabels: Array.from(xLabels).sort() };
    };

    // Determine which plot data to use
            const timeSeriesPlotResult = createTimeSeriesViolinPlotData();

    const timeSeriesPlotLayout = timeSeriesPlotResult ? {
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
    } : null;

    const timeSeriesPlotConfig = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false
    };

    const getTimeSeriesDataSummary = () => {
        const timeSeriesData = prepareTimeSeriesViolinData();
        if (!timeSeriesData) return null;

        const processSummary = (dataset, datasetName) => {
            const biomarkerCounts = dataset.map(group => ({
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
                name: datasetName,
                totalTimePoints: biomarkerCounts.length,
                totalReadings,
                avgReadingsPerTime: avgReadingsPerTime.toFixed(1),
                timePointsWithMultipleReadings: biomarkerCounts.filter(item => item.count > 1).length
            };
        };

        const mainSummary = processSummary(timeSeriesData.main, 'Dataset 1');

        return {
            main: mainSummary,
            comparison: null
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
                                    value={filters.ageMin}
                                    onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                                    inputProps={{ min: 0, max: 150 }}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label="Max Age"
                                    value={filters.ageMax}
                                    onChange={(e) => handleFilterChange('ageMax', e.target.value)}
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

                {allUsersData.length > 0 ? (
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
                                <Grid item xs={12} md={graphType === 'violin' ? 2 : 4}>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        {`Each violin shows the population distribution of ${selectedBiomarker} readings from all users and sensors at a specific time point.`}
                                        Single readings are shown as scatter points.
                                        {showMovingAverage && ` The moving average line (${movingAverageWindow}-point window) smooths the mean values across time points to reveal trends.`}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Time Series Violin Plot */}
                        {timeSeriesPlotResult && timeSeriesPlotResult.plotData.length > 0 ? (
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Plot
                                    data={timeSeriesPlotResult.plotData}
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
                        {(() => {
                            const summary = getTimeSeriesDataSummary();
                            return summary && (
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
                                                {summary.main.totalTimePoints}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Population Readings:
                                            </Typography>
                                            <Typography variant="h6">
                                                {summary.main.totalReadings}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                Avg Readings per Time:
                                            </Typography>
                                            <Typography variant="h6">
                                                {summary.main.avgReadingsPerTime}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                Violin Plots (≥2 readings):
                                            </Typography>
                                            <Typography variant="h6">
                                                {summary.main.timePointsWithMultipleReadings}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            );
                        })()}
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

export default AggregatedViolinPlots; 