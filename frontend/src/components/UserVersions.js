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
    Chip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceIcon from '@mui/icons-material/Science';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
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
                    <Tab label="Sensor Data" />
                    <Tab label="AGP Report" />
                </Tabs>

                <Box sx={{ mt: 3 }}>
                    {currentTab === 0 ? (
                        // Device Info Tab
                        <Container maxWidth="md">
                            <Paper sx={{ p: 4, mt: 2 }}>
                                <Typography variant="h4" gutterBottom align="center" color="primary">
                                    User Device Information
                                </Typography>
                                {(versionId && sensorData?.data_snapshot?.device_info) || userDeviceInfo ? (
                                    <Grid container spacing={3} sx={{ mt: 2 }}>
                                        <Grid item xs={12} md={6}>
                                            <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                                                <Typography variant="h6" gutterBottom color="primary">
                                                    User Details
                                                </Typography>
                                                <Box sx={{ '& > div': { mb: 2 } }}>
                                                    {(() => {
                                                        const deviceInfo = versionId ? sensorData?.data_snapshot?.device_info : userDeviceInfo?.device_info;
                                                        const displayUsername = versionId ? username : userDeviceInfo?.username;
                                                        return (
                                                            <>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>Username:</strong></Typography>
                                                                    <Typography variant="body1">{displayUsername}</Typography>
                                                                </Box>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>User ID:</strong></Typography>
                                                                    <Typography variant="body1">{deviceInfo?.userID}</Typography>
                                                                </Box>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>Gender:</strong></Typography>
                                                                    <Typography variant="body1">{deviceInfo?.gender}</Typography>
                                                                </Box>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>Age:</strong></Typography>
                                                                    <Typography variant="body1">{deviceInfo?.age?.$numberInt || deviceInfo?.age}</Typography>
                                                                </Box>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>Arm:</strong></Typography>
                                                                    <Typography variant="body1">{deviceInfo?.arm}</Typography>
                                                                </Box>
                                                            </>
                                                        );
                                                    })()}
                                                </Box>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                                                <Typography variant="h6" gutterBottom color="primary">
                                                    Device & Technical Details
                                                </Typography>
                                                <Box sx={{ '& > div': { mb: 2 } }}>
                                                    {(() => {
                                                        const deviceInfo = versionId ? sensorData?.data_snapshot?.device_info : userDeviceInfo?.device_info;
                                                        const currentData = versionId ? sensorData : userDeviceInfo;
                                                        return (
                                                            <>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>Device ID:</strong></Typography>
                                                                    <Typography variant="body1">{deviceInfo?.deviceID}</Typography>
                                                                </Box>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>Sensor Combination:</strong></Typography>
                                                                    <Typography variant="body1">{deviceInfo?.sensorCombination}</Typography>
                                                                </Box>
                                                                <Box display="flex" justifyContent="space-between">
                                                                    <Typography variant="body1"><strong>Epoch:</strong></Typography>
                                                                    <Typography variant="body1">{deviceInfo?.epoch}</Typography>
                                                                </Box>
                                                                {!versionId && (
                                                                    <>
                                                                        <Box display="flex" justifyContent="space-between">
                                                                            <Typography variant="body1"><strong>ETag:</strong></Typography>
                                                                            <Typography variant="body1" sx={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>{currentData?.etag}</Typography>
                                                                        </Box>
                                                                        <Box display="flex" justifyContent="space-between">
                                                                            <Typography variant="body1"><strong>Last Modified:</strong></Typography>
                                                                            <Typography variant="body1">{formatDate(currentData?.last_modified)}</Typography>
                                                                        </Box>
                                                                        {currentData?.processed_at && (
                                                                            <Box display="flex" justifyContent="space-between">
                                                                                <Typography variant="body1"><strong>Processed At:</strong></Typography>
                                                                                <Typography variant="body1">{formatDate(currentData.processed_at.$date?.$numberLong ? new Date(parseInt(currentData.processed_at.$date.$numberLong)) : currentData.processed_at)}</Typography>
                                                                            </Box>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {versionId && (
                                                                    <>
                                                                        <Box display="flex" justifyContent="space-between">
                                                                            <Typography variant="body1"><strong>Version Number:</strong></Typography>
                                                                            <Typography variant="body1">{sensorData?.version_number?.$numberInt || sensorData?.version_number}</Typography>
                                                                        </Box>
                                                                        <Box display="flex" justifyContent="space-between">
                                                                            <Typography variant="body1"><strong>Version Date:</strong></Typography>
                                                                            <Typography variant="body1">{formatDate(sensorData?.versioned_at)}</Typography>
                                                                        </Box>
                                                                        <Box display="flex" justifyContent="space-between">
                                                                            <Typography variant="body1"><strong>Total Readings:</strong></Typography>
                                                                            <Typography variant="body1">{sensorData?.data_snapshot?.total_readings?.$numberInt || sensorData?.data_snapshot?.data_points?.length}</Typography>
                                                                        </Box>
                                                                    </>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </Box>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                                                <Typography variant="h6" gutterBottom color="primary">
                                                    {versionId ? 'Version Information' : 'File Information'}
                                                </Typography>
                                                <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
                                                    <Typography variant="body1"><strong>{versionId ? 'Version ID:' : 'File ID:'}</strong></Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>
                                                        {versionId ? (sensorData?._id?.$oid || sensorData?._id) : userDeviceInfo?._id}
                                                    </Typography>
                                                </Box>
                                                {versionId && sensorData?.data_snapshot && (
                                                    <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
                                                        <Typography variant="body1"><strong>Data Range:</strong></Typography>
                                                        <Typography variant="body1" sx={{ fontSize: '0.9rem' }}>
                                                            {sensorData.data_snapshot.start_time && sensorData.data_snapshot.end_time ?
                                                                `${formatDate(sensorData.data_snapshot.start_time)} - ${formatDate(sensorData.data_snapshot.end_time)}` :
                                                                'N/A'
                                                            }
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Paper>
                                        </Grid>
                                        {/* Personal Information Section */}
                                        {personalInfo && (
                                            <Grid item xs={12}>
                                                <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                                                    <Typography variant="h6" gutterBottom color="primary">
                                                        Personal Information
                                                    </Typography>
                                                    <Grid container spacing={2}>
                                                        {Object.entries(personalInfo.personal_information).map(([key, value]) => (
                                                            <Grid item xs={12} sm={6} md={4} key={key}>
                                                                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                                                    <Typography variant="body1">
                                                                        <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong>
                                                                    </Typography>
                                                                    <Chip 
                                                                        label={value === true ? 'Yes' : value === false ? 'No' : value}
                                                                        color={value === true ? 'success' : value === false ? 'default' : 'primary'}
                                                                        size="small"
                                                                        variant={typeof value === 'boolean' ? 'filled' : 'outlined'}
                                                                    />
                                                                </Box>
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                    {personalInfo.updated_at && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                                                            Last updated: {formatDate(personalInfo.updated_at)}
                                                        </Typography>
                                                    )}
                                                </Paper>
                                            </Grid>
                                        )}
                                    </Grid>
                                ) : (
                                    <Typography variant="body1" align="center" sx={{ mt: 4 }}>
                                        No device information available for this user.
                                    </Typography>
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
                        sensorData && sensorTableData.length > 0 ? (
                            <Paper sx={{ p: 3 }}>
                                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h5" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ScienceIcon />
                                        Sensor Data Readings
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {sensorTableData.length} readings • Real-time biomarker data
                                    </Typography>
                                </Box>

                                <Box sx={{ height: 600, width: '100%' }}>
                                    <DataGrid
                                        rows={sensorTableData}
                                        columns={[
                                            {
                                                field: 'reading',
                                                headerName: 'Reading #',
                                                width: 100,
                                                type: 'number',
                                                renderCell: (params) => (
                                                    <Typography variant="body2" fontWeight="medium">
                                                        #{params.value}
                                                    </Typography>
                                                )
                                            },
                                            {
                                                field: 'dateTime',
                                                headerName: 'Date & Time',
                                                width: 180,
                                                renderCell: (params) => (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {params.value}
                                                    </Typography>
                                                )
                                            },
                                            {
                                                field: 'cortisol1',
                                                headerName: 'Cortisol Sensor 1',
                                                width: 150,
                                                type: 'number',
                                                renderCell: (params) => (
                                                    params.value ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <BloodtypeIcon color="primary" fontSize="small" />
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {params.value} ng/mL
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled">
                                                            No Data
                                                        </Typography>
                                                    )
                                                )
                                            },
                                            {
                                                field: 'cortisol2',
                                                headerName: 'Cortisol Sensor 2',
                                                width: 150,
                                                type: 'number',
                                                renderCell: (params) => (
                                                    params.value ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <BloodtypeIcon color="secondary" fontSize="small" />
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {params.value} ng/mL
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled">
                                                            No Data
                                                        </Typography>
                                                    )
                                                )
                                            },
                                            {
                                                field: 'glucose1',
                                                headerName: 'Glucose Sensor 1',
                                                width: 150,
                                                type: 'number',
                                                renderCell: (params) => (
                                                    params.value ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <ScienceIcon color="success" fontSize="small" />
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {params.value} mg/dL
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled">
                                                            No Data
                                                        </Typography>
                                                    )
                                                )
                                            },
                                            {
                                                field: 'glucose2',
                                                headerName: 'Glucose Sensor 2',
                                                width: 150,
                                                type: 'number',
                                                renderCell: (params) => (
                                                    params.value ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <ScienceIcon color="warning" fontSize="small" />
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {params.value} mg/dL
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled">
                                                            No Data
                                                        </Typography>
                                                    )
                                                )
                                            },
                                            {
                                                field: 'status',
                                                headerName: 'Status',
                                                width: 120,
                                                renderCell: (params) => (
                                                    <Chip 
                                                        label={params.value}
                                                        size="small"
                                                        color={params.value === 'Valid' ? 'success' : 'default'}
                                                        variant={params.value === 'Valid' ? 'filled' : 'outlined'}
                                                    />
                                                )
                                            }
                                        ]}
                                        pageSize={15}
                                        rowsPerPageOptions={[15, 25, 50, 100]}
                                        disableSelectionOnClick
                                        sx={{
                                            '& .MuiDataGrid-cell:focus': {
                                                outline: 'none'
                                            },
                                            '& .MuiDataGrid-row:focus': {
                                                outline: 'none'
                                            },
                                            '& .MuiDataGrid-columnHeaders': {
                                                backgroundColor: 'primary.main',
                                                color: 'primary.contrastText',
                                                fontWeight: 'bold'
                                            }
                                        }}
                                        components={{
                                            NoRowsOverlay: () => (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                                    <Typography variant="h6" color="text.secondary">
                                                        No sensor readings available
                                                    </Typography>
                                                </Box>
                                            )
                                        }}
                                    />
                                </Box>
                            </Paper>
                        ) : (
                            <Container maxWidth="md">
                                <Paper sx={{ p: 4, mt: 2 }}>
                                    <Typography variant="h6" align="center" color="text.secondary">
                                        No sensor data available for this user.
                                    </Typography>
                                    <Typography variant="body2" align="center" sx={{ mt: 2 }}>
                                        This user has device information but no sensor data readings to display.
                                    </Typography>
                                </Paper>
                            </Container>
                        )
                    ) : (currentTab === (versionId ? 2 : 3)) ? (
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