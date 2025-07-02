import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import config from '../config';
import {
    Container,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    IconButton,
    Box,
    AppBar,
    Toolbar,
    Tab,
    Tabs,
    Grid,
    styled,
    Chip,
    Stack,
    Divider
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import AGPReport from './AGPReport';

// Styled components
const StyledTableCell = styled(TableCell)(({ theme }) => ({
    padding: '20px 24px',  // Increased padding
    fontSize: '1rem',
    '&.MuiTableCell-head': {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.common.white,
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        fontSize: '1.1rem'  // Slightly larger header text
    },
    width: 'auto',  // Allow cells to take necessary width
    textAlign: 'left'  // Default alignment
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
        backgroundColor: theme.palette.action.hover,
    },
    '&:hover': {
        backgroundColor: theme.palette.action.selected,
    },
    '& > td': {
        borderBottom: `1px solid ${theme.palette.divider}`,
    }
}));

const UserVersions = () => {
    const [versions, setVersions] = useState([]);
    const [dataVersions, setDataVersions] = useState([]);
    const [userDeviceInfo, setUserDeviceInfo] = useState(null);
    const [personalInfo, setPersonalInfo] = useState(null);
    const [sensorData, setSensorData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTab, setCurrentTab] = useState(0);
    const { username, versionId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/');
                    return;
                }

                // If we have a versionId, fetch that specific version's data
                if (versionId) {
                    console.log('Fetching specific version data for versionId:', versionId);
                    try {
                        const versionDataResponse = await axios.get(`${config.API_URL}/version-data/${versionId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        console.log('Version data response:', versionDataResponse.data);
                        setSensorData(versionDataResponse.data);
                        setLoading(false);
                        return;
                    } catch (error) {
                        console.error('Failed to fetch version data:', error.response?.data || error.message);
                        setError('Failed to fetch version data: ' + (error.response?.data?.error || error.message));
                        setLoading(false);
                        return;
                    }
                }

                // Fetch user device info first
                const deviceInfoResponse = await axios.get(`${config.API_URL}/user-device-info/${username}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                setUserDeviceInfo(deviceInfoResponse.data);

                // Fetch personal information
                try {
                    const personalInfoResponse = await axios.get(`${config.API_URL}/user-personal-info/${username}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    setPersonalInfo(personalInfoResponse.data);
                } catch (personalInfoError) {
                    console.log('No personal information found for user:', personalInfoError.response?.data?.error);
                    setPersonalInfo(null);
                }

                // Fetch versions and sensor data in parallel
                const promises = [
                    axios.get(`${config.API_URL}/user-versions/${username}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }).catch(err => {
                        console.warn('No versions found for user:', err.response?.data?.error);
                        return { data: [] };
                    })
                ];

                // Fetch sensor data and data versions
                if (deviceInfoResponse.data.etag) {
                    promises.push(
                        axios.get(`${config.API_URL}/user-sensor-data/${deviceInfoResponse.data.etag}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).catch(err => {
                            console.warn('No sensor data found for etag:', err.response?.data?.error);
                            return { data: null };
                        })
                    );
                }
                
                // Fetch data versions using the patient_id from device info
                // Look for patient_id in the device info or use a derived value
                let patientId = username; // fallback to username
                if (deviceInfoResponse.data._id) {
                    // Extract the base filename from the _id (e.g., "visualization-test-bucket-private/Test_output.txt" -> "Test_output")
                    const fileId = deviceInfoResponse.data._id;
                    const fileName = fileId.split('/').pop(); // Get the filename
                    patientId = fileName.replace(/\.(txt|csv|json)$/i, ''); // Remove common file extensions
                }
                
                console.log(`Fetching data versions for patient_id: ${patientId} (derived from file: ${deviceInfoResponse.data._id})`);
                promises.push(
                    axios.get(`${config.API_URL}/data-versions/${patientId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }).then(response => {
                        console.log('Data versions API success:', response.data);
                        return response;
                    }).catch(err => {
                        console.error('Data versions API error:', err.response?.data || err.message);
                        return { data: [] };
                    })
                );

                const responses = await Promise.all(promises);
                const versionsResponse = responses[0];
                let sensorDataResponse = null;
                let dataVersionsResponse = null;
                
                if (deviceInfoResponse.data.etag) {
                    sensorDataResponse = responses[1];
                    dataVersionsResponse = responses[2];
                } else {
                    dataVersionsResponse = responses[1];
                }

                // Sort versions by version number in ascending order
                const sortedVersions = versionsResponse.data.sort((a, b) => {
                    const versionA = parseInt(a.version_number) || 0;
                    const versionB = parseInt(b.version_number) || 0;
                    return versionA - versionB;
                });
                setVersions(sortedVersions);

                // Set sensor data if available
                if (sensorDataResponse && sensorDataResponse.data) {
                    setSensorData(sensorDataResponse.data);
                }

                // Set data versions if available
                console.log('Data versions response:', dataVersionsResponse);
                if (dataVersionsResponse && dataVersionsResponse.data) {
                    console.log('Setting data versions:', dataVersionsResponse.data);
                    setDataVersions(dataVersionsResponse.data);
                } else {
                    console.log('No data versions found or invalid response');
                }
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch user data');
                setLoading(false);
            }
        };

        fetchData();
    }, [username, versionId, navigate]);

    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';
        
        if (typeof dateValue === 'string') {
            return new Date(dateValue).toLocaleString();
        }
        
        if (dateValue.$date) {
            if (dateValue.$date.$numberLong) {
                return new Date(parseInt(dateValue.$date.$numberLong)).toLocaleString();
            }
            return new Date(dateValue.$date).toLocaleString();
        }
        
        return new Date(dateValue).toLocaleString();
    };

    const handleBack = () => {
        if (versionId) {
            // If viewing a specific version, go back to the user versions page
            navigate(`/user-versions/${username}`);
        } else {
            // If viewing user versions, go back to the main dashboard
            navigate('/');
        }
    };

    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    const prepareGraphData = () => {
        if (!versions || versions.length === 0) return [];
        return versions.map(version => ({
            date: formatDate(version.versioned_at),
            hr: parseInt(version.data_snapshot.vitals.hr),
            temp: parseFloat(version.data_snapshot.vitals.temp),
            bp_systolic: parseInt(version.data_snapshot.vitals.bp.split('/')[0]),
            bp_diastolic: parseInt(version.data_snapshot.vitals.bp.split('/')[1]),
            o2: parseInt(version.data_snapshot.vitals.o2),
            resp: parseInt(version.data_snapshot.vitals.resp),
            weight: parseInt(version.data_snapshot.vitals.weight)
        }));  // Removed .reverse() to maintain the ascending order
    };

    const prepareSensorTableData = () => {
        // Handle both current sensor data and version data formats
        let dataPoints;
        if (versionId && sensorData?.data_snapshot?.data_points) {
            // Version data format
            dataPoints = sensorData.data_snapshot.data_points;
        } else if (sensorData?.data?.data_points) {
            // Current sensor data format
            dataPoints = sensorData.data.data_points;
        } else {
            return [];
        }
        
        // Debug: Log the first data point to understand the structure
        if (dataPoints.length > 0) {
            console.log('First sensor data point:', dataPoints[0]);
        }
        
        return dataPoints.map((point, index) => {
            let timestamp;
            let dateTime;
            
            try {
                // Handle different timestamp formats
                if (point.timestamp?.$date?.$numberLong) {
                    timestamp = parseInt(point.timestamp.$date.$numberLong);
                } else if (point.timestamp?.$date) {
                    timestamp = new Date(point.timestamp.$date).getTime();
                } else if (point.timestamp) {
                    timestamp = new Date(point.timestamp).getTime();
                } else if (point.time) {
                    // Use time field if timestamp is not available
                    const timeValue = point.time?.$numberInt || point.time;
                    timestamp = parseInt(timeValue) * 1000; // Convert seconds to milliseconds
                } else {
                    timestamp = Date.now() + (index * 1000); // Fallback with incremental time
                }
                
                dateTime = new Date(timestamp);
            } catch (error) {
                console.warn('Error parsing timestamp for point:', point, error);
                timestamp = Date.now() + (index * 1000);
                dateTime = new Date(timestamp);
            }
            
            // Extract sensor values
            const cortisol1 = point['Cortisol(ng/mL)']?.$numberDouble || point['Cortisol(ng/mL)'];
            const glucose1 = point['Glucose(mg/dL)']?.$numberDouble || point['Glucose(mg/dL)'];
            const cortisol2 = point['Cortisol(ng/mL)_2']?.$numberDouble || point['Cortisol(ng/mL)_2'];
            const glucose2 = point['Glucose(mg/dL)_2']?.$numberDouble || point['Glucose(mg/dL)_2'];
            
            return {
                id: index,
                reading: index + 1,
                timestamp: timestamp,
                dateTime: dateTime.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }),
                time: dateTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }),
                cortisol1: cortisol1 !== null && cortisol1 !== undefined && !isNaN(cortisol1) ? Number(cortisol1).toFixed(3) : null,
                glucose1: glucose1 !== null && glucose1 !== undefined && !isNaN(glucose1) ? Number(glucose1).toFixed(2) : null,
                cortisol2: cortisol2 !== null && cortisol2 !== undefined && !isNaN(cortisol2) ? Number(cortisol2).toFixed(3) : null,
                glucose2: glucose2 !== null && glucose2 !== undefined && !isNaN(glucose2) ? Number(glucose2).toFixed(2) : null,
                status: (cortisol1 || cortisol2 || glucose1 || glucose2) ? 'Valid' : 'No Data'
            };
        }).sort((a, b) => a.timestamp - b.timestamp);
    };

    if (loading) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
            <Typography>Loading...</Typography>
        </Box>
    );

    if (error) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
            <Typography color="error">{error}</Typography>
        </Box>
    );

    const graphData = prepareGraphData();
    const sensorTableData = prepareSensorTableData();

    return (
        <Container maxWidth={false} sx={{ mb: 4, px: 4 }}>
            <AppBar position="static" color="default" elevation={0}>
                <Toolbar>
                    <IconButton edge="start" onClick={handleBack}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ ml: 2 }}>
                        {versionId ? `Version Data - ${username}` : `Patient Data Versions - ${username}`}
                    </Typography>
                </Toolbar>
            </AppBar>

            <Box sx={{ mt: 3 }}>
                <Tabs 
                    value={currentTab} 
                    onChange={handleTabChange}
                    sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        mb: 3
                    }}
                >
                    <Tab label="Device Info" />
                    {!versionId && <Tab label="Past Data" />}
                    <Tab label="AGP Report" />
                </Tabs>

                <Box sx={{ mt: 3 }}>
                    {currentTab === 0 ? (
                        // Device Info Tab
                        <Container maxWidth="lg">
                            <Paper sx={{ p: 3, mt: 2, boxShadow: 1 }}>
                                <Typography variant="h5" gutterBottom align="center" sx={{ mb: 4, fontWeight: 'bold' }}>
                                    User Device Information
                                </Typography>
                                {(versionId && sensorData?.data_snapshot?.device_info) || userDeviceInfo ? (
                                    <Grid container spacing={3}>
                                        {/* User Details Section */}
                                        <Grid item xs={12} md={6}>
                                            <Paper variant="outlined" sx={{ p: 3, height: 'fit-content' }}>
                                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2, borderBottom: '1px solid #e0e0e0', pb: 1 }}>
                                                    User Details
                                                </Typography>
                                                <Stack spacing={1.5}>
                                                    {(() => {
                                                        const deviceInfo = versionId ? sensorData?.data_snapshot?.device_info : userDeviceInfo?.device_info;
                                                        const displayUsername = versionId ? username : userDeviceInfo?.username;
                                                        return (
                                                            <>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '120px' }}>Username:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right', fontFamily: 'monospace' }}>{displayUsername || 'N/A'}</Typography>
                                                                </Box>
                                                                <Divider />
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '120px' }}>User ID:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right', fontFamily: 'monospace' }}>{deviceInfo?.userID || 'N/A'}</Typography>
                                                                </Box>
                                                                <Divider />
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '120px' }}>Gender:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{deviceInfo?.gender || 'N/A'}</Typography>
                                                                </Box>
                                                                <Divider />
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '120px' }}>Age:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{deviceInfo?.age?.$numberInt || deviceInfo?.age || 'N/A'}</Typography>
                                                                </Box>
                                                                <Divider />
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '120px' }}>Arm:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{deviceInfo?.arm || 'N/A'}</Typography>
                                                                </Box>
                                                            </>
                                                        );
                                                    })()}
                                                </Stack>
                                            </Paper>
                                        </Grid>

                                        {/* Device & Technical Details Section */}
                                        <Grid item xs={12} md={6}>
                                            <Paper variant="outlined" sx={{ p: 3, height: 'fit-content' }}>
                                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2, borderBottom: '1px solid #e0e0e0', pb: 1 }}>
                                                    Device &amp; Technical Details
                                                </Typography>
                                                <Stack spacing={1.5}>
                                                    {(() => {
                                                        const deviceInfo = versionId ? sensorData?.data_snapshot?.device_info : userDeviceInfo?.device_info;
                                                        const currentData = versionId ? sensorData : userDeviceInfo;
                                                        return (
                                                            <>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Device ID:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right', fontFamily: 'monospace' }}>{deviceInfo?.deviceID || 'N/A'}</Typography>
                                                                </Box>
                                                                <Divider />
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Sensor Combination:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right' }}>{deviceInfo?.sensorCombination || 'N/A'}</Typography>
                                                                </Box>
                                                                <Divider />
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Epoch:</Typography>
                                                                    <Typography variant="body2" sx={{ textAlign: 'right', fontFamily: 'monospace' }}>{deviceInfo?.epoch || 'N/A'}</Typography>
                                                                </Box>
                                                                {!versionId && (
                                                                    <>
                                                                        <Divider />
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.5 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>ETag:</Typography>
                                                                            <Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '250px' }}>
                                                                                {currentData?.etag || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Divider />
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Last Modified:</Typography>
                                                                            <Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.85rem' }}>{formatDate(currentData?.last_modified) || 'N/A'}</Typography>
                                                                        </Box>
                                                                        {currentData?.processed_at && (
                                                                            <>
                                                                                <Divider />
                                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Processed At:</Typography>
                                                                                    <Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.85rem' }}>
                                                                                        {formatDate(currentData.processed_at.$date?.$numberLong ? new Date(parseInt(currentData.processed_at.$date.$numberLong)) : currentData.processed_at)}
                                                                                    </Typography>
                                                                                </Box>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {versionId && (
                                                                    <>
                                                                        <Divider />
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Version Number:</Typography>
                                                                            <Typography variant="body2" sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                                                                {sensorData?.version_number?.$numberInt || sensorData?.version_number || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Divider />
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Version Date:</Typography>
                                                                            <Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.85rem' }}>{formatDate(sensorData?.versioned_at) || 'N/A'}</Typography>
                                                                        </Box>
                                                                        <Divider />
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 'medium', minWidth: '140px' }}>Total Readings:</Typography>
                                                                            <Typography variant="body2" sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                                                                {sensorData?.data_snapshot?.total_readings?.$numberInt || sensorData?.data_snapshot?.data_points?.length || 'N/A'}
                                                                            </Typography>
                                                                        </Box>
                                                                    </>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </Stack>
                                            </Paper>
                                        </Grid>

                                        {/* Personal Information Section */}
                                        {personalInfo && (
                                            <Grid item xs={12} sx={{ mt: 2 }}>
                                                <Paper variant="outlined" sx={{ p: 3 }}>
                                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2, borderBottom: '1px solid #e0e0e0', pb: 1 }}>
                                                        Personal Information
                                                    </Typography>
                                                    <Grid container spacing={2}>
                                                        {Object.entries(personalInfo.personal_information).map(([key, value]) => (
                                                            <Grid item xs={12} sm={6} md={3} key={key}>
                                                                <Box sx={{ 
                                                                    display: 'flex', 
                                                                    justifyContent: 'space-between', 
                                                                    alignItems: 'center', 
                                                                    p: 1.5, 
                                                                    borderRadius: 1, 
                                                                    border: '1px solid #e0e0e0',
                                                                    bgcolor: 'grey.50',
                                                                    height: '48px'
                                                                }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 'medium', fontSize: '0.875rem' }}>
                                                                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                                                    </Typography>
                                                                    <Chip 
                                                                        label={value === true ? 'Yes' : value === false ? 'No' : value}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ 
                                                                            fontSize: '0.75rem',
                                                                            height: '26px',
                                                                            borderColor: '#d0d0d0',
                                                                            bgcolor: 'white',
                                                                            color: 'text.primary',
                                                                            '& .MuiChip-label': {
                                                                                fontWeight: 'medium'
                                                                            }
                                                                        }}
                                                                    />
                                                                </Box>
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                    {personalInfo.updated_at && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}>
                                                            Last updated: {formatDate(personalInfo.updated_at)}
                                                        </Typography>
                                                    )}
                                                </Paper>
                                            </Grid>
                                        )}
                                    </Grid>
                                ) : (
                                    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                                        <Typography variant="body1" color="text.secondary">
                                            No device information available for this user.
                                        </Typography>
                                    </Paper>
                                )}
                            </Paper>
                        </Container>
                    ) : (!versionId && currentTab === 1) ? (
                        (() => {
                            console.log('Current tab:', currentTab, 'versionId:', versionId);
                            console.log('Checking data versions for display:', dataVersions);
                            console.log('Data versions length:', dataVersions?.length);
                            console.log('Data versions type:', typeof dataVersions);
                            console.log('Is array?', Array.isArray(dataVersions));
                            const hasData = dataVersions && dataVersions.length > 0;
                            console.log('Has data?', hasData);
                            return hasData;
                        })() ? (
                            <TableContainer 
                                component={Paper} 
                                sx={{ 
                                    maxHeight: 'calc(100vh - 250px)',
                                    overflow: 'auto',
                                    width: '100.3%',
                                    '& .MuiTable-root': {
                                        tableLayout: 'fixed',  // Fixed table layout
                                        width: '100%',  // Full width
                                        borderCollapse: 'separate',
                                        borderSpacing: '0',
                                    }
                                }}
                            >
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <StyledTableCell width="15%">Version</StyledTableCell>
                                            <StyledTableCell width="25%">Date Created</StyledTableCell>
                                            <StyledTableCell width="20%">Patient ID</StyledTableCell>
                                            <StyledTableCell width="15%">Total Readings</StyledTableCell>
                                            <StyledTableCell width="25%">Data Range</StyledTableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dataVersions.map((version) => (
                                            <StyledTableRow 
                                                key={version._id.$oid || version._id}
                                                sx={{ 
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        backgroundColor: 'action.hover',
                                                    }
                                                }}
                                                onClick={() => {
                                                    const vId = version._id.$oid || version._id;
                                                    console.log('Clicking on version, ID:', vId, 'Full version object:', version);
                                                    navigate(`/user-versions/${username}/version/${vId}`);
                                                }}
                                            >
                                                <StyledTableCell>{version.version_number}</StyledTableCell>
                                                <StyledTableCell sx={{ whiteSpace: 'nowrap' }}>
                                                    {formatDate(version.versioned_at)}
                                                </StyledTableCell>
                                                <StyledTableCell>{version.patient_id}</StyledTableCell>
                                                <StyledTableCell align="center">
                                                    {version.data_snapshot?.total_readings?.$numberInt || version.data_snapshot?.data_points?.length || 'N/A'}
                                                </StyledTableCell>
                                                <StyledTableCell>
                                                    {version.data_snapshot?.start_time && version.data_snapshot?.end_time ? 
                                                        `${formatDate(version.data_snapshot.start_time)} - ${formatDate(version.data_snapshot.end_time)}` :
                                                        'N/A'
                                                    }
                                                </StyledTableCell>
                                            </StyledTableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Container maxWidth="md">
                                <Paper sx={{ p: 4, mt: 2 }}>
                                    <Typography variant="h6" align="center" color="text.secondary">
                                        No data history available for this user.
                                    </Typography>
                                    <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                                        This user has device information but no historical data versions.
                                    </Typography>
                                </Paper>
                            </Container>
                        )
                    ) : (currentTab === (versionId ? 1 : 2)) ? (
                        // AGP Report Tab
                        sensorData && sensorTableData.length > 0 ? (
                            <AGPReport 
                                username={username}
                                embedMode={true}
                            />
                        ) : (
                            <Container maxWidth="md">
                                <Paper sx={{ p: 4, mt: 2 }}>
                                    <Typography variant="h6" align="center" color="text.secondary">
                                        No sensor data available for AGP report.
                                    </Typography>
                                    <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                                        Please ensure sensor data is available before viewing the AGP report.
                                    </Typography>
                                </Paper>
                            </Container>
                        )
                    ) : null}
                </Box>
            </Box>
        </Container>
    );
};

export default UserVersions;