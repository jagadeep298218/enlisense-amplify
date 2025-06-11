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
    ListItemText
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

    const cortisolPlot = {
        data: [
            ...(aggregatedData.cortisol.length > 0 ? [{
                type: 'violin',
                y: aggregatedData.cortisol,
                name: 'Cortisol (ng/mL)',
                box: { visible: true },
                meanline: { visible: true },
                fillcolor: 'rgba(136, 132, 216, 0.6)',
                line: { color: 'rgb(136, 132, 216)' },
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
            title: { text: 'Filtered Cortisol Distribution (ng/mL)', font: { size: 18 } },
            yaxis: { title: 'Cortisol (ng/mL)', zeroline: false, titlefont: { size: 14 } },
            xaxis: { title: 'Biomarker', titlefont: { size: 14 } },
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
            ...(aggregatedData.glucose.length > 0 ? [{
                type: 'violin',
                y: aggregatedData.glucose,
                name: 'Glucose (mg/dL)',
                box: { visible: true },
                meanline: { visible: true },
                fillcolor: 'rgba(130, 202, 157, 0.6)',
                line: { color: 'rgb(130, 202, 157)' },
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
            title: { text: 'Filtered Glucose Distribution (mg/dL)', font: { size: 18 } },
            yaxis: { title: 'Glucose (mg/dL)', zeroline: false, titlefont: { size: 14 } },
            xaxis: { title: 'Biomarker', titlefont: { size: 14 } },
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

                {aggregatedData.cortisol.length > 0 || aggregatedData.glucose.length > 0 ? (
                    <>
                        <Typography variant="h5" gutterBottom align="center" color="primary" sx={{ mb: 3 }}>
                            {getActiveFiltersCount() > 0 ? 'Filtered' : 'Population-Level'} Biomarker Distribution Analysis
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, mb: 3 }}>
                            {aggregatedData.cortisol.length > 0 && (
                                <Paper sx={{ p: 2, flex: 1, minWidth: 0 }}>
                                    <Plot
                                        data={cortisolPlot.data}
                                        layout={cortisolPlot.layout}
                                        config={cortisolPlot.config}
                                        useResizeHandler={false}
                                        style={{ width: '100%', height: '500px' }}
                                    />
                                </Paper>
                            )}

                            {aggregatedData.glucose.length > 0 && (
                                <Paper sx={{ p: 2, flex: 1, minWidth: 0 }}>
                                    <Plot
                                        data={glucosePlot.data}
                                        layout={glucosePlot.layout}
                                        config={glucosePlot.config}
                                        useResizeHandler={false}
                                        style={{ width: '100%', height: '500px' }}
                                    />
                                </Paper>
                            )}
                        </Box>

                        <Paper sx={{ p: 3, mt: 3, bgcolor: 'background.default' }}>
                            <Typography variant="h6" gutterBottom color="primary">Statistical Summary</Typography>
                            <Grid container spacing={3}>
                                {aggregatedData.cortisol.length > 0 && (
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="h6" color="primary" gutterBottom>Cortisol (ng/mL)</Typography>
                                        <Typography variant="body1">
                                            <strong>Mean:</strong> {(aggregatedData.cortisol.reduce((a, b) => a + b, 0) / aggregatedData.cortisol.length).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Min:</strong> {Math.min(...aggregatedData.cortisol).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Max:</strong> {Math.max(...aggregatedData.cortisol).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Total Readings:</strong> {aggregatedData.cortisol.length}
                                        </Typography>
                                    </Grid>
                                )}
                                {aggregatedData.glucose.length > 0 && (
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="h6" color="primary" gutterBottom>Glucose (mg/dL)</Typography>
                                        <Typography variant="body1">
                                            <strong>Mean:</strong> {(aggregatedData.glucose.reduce((a, b) => a + b, 0) / aggregatedData.glucose.length).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Min:</strong> {Math.min(...aggregatedData.glucose).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Max:</strong> {Math.max(...aggregatedData.glucose).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Total Readings:</strong> {aggregatedData.glucose.length}
                                        </Typography>
                                    </Grid>
                                )}
                            </Grid>
                        </Paper>
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