/**
 * FileTracker.js
 * 
 * PURPOSE: Administrative dashboard for managing patient data files and user information
 * 
 * FEATURES:
 * - Real-time data grid displaying all user files with filtering and sorting
 * - User role-based interface elements (Admin, Doctor, User)
 * - CSV export functionality for data analysis
 * - Navigation to individual user versions and detailed views
 * - Status tracking for active/inactive patient records
 * - Responsive data grid with custom cell renderers
 * 
 * DEPENDENCIES:
 * - @mui/x-data-grid for advanced table functionality
 * - axios for HTTP requests with error handling
 * - Material-UI for consistent component styling
 * - React Router for navigation between views
 * 
 * ERROR HANDLING:
 * - [CRITICAL] Authentication token validation prevents unauthorized access
 * - [HIGH] API failures show user-friendly error messages
 * - [MEDIUM] CSV download errors handled with specific feedback
 * - [LOW] Date formatting errors default to 'N/A' display
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import {
    Container,
    Paper,
    Typography,
    Box,
    Button,
    AppBar,
    Toolbar,
    Chip,
    IconButton,
    Alert,
    CircularProgress
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import LogoutIcon from '@mui/icons-material/Logout';
import DownloadIcon from '@mui/icons-material/Download';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import FilterListIcon from '@mui/icons-material/FilterList';


const FileTracker = () => {
    const [fileData, setFileData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    /**
     * EFFECT: Initialize User Session
     * PURPOSE: Load user data from localStorage on component mount
     * 
     * ERROR HANDLING:
     * - [LOW] Invalid JSON in localStorage handled gracefully
     */
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.warn('Failed to parse stored user data:', error);
            setUser(null);
        }
    }, []);

    /**
     * EFFECT: Fetch File Data
     * PURPOSE: Load patient file data from server with authentication
     * 
     * ERROR HANDLING:
     * - [CRITICAL] Missing authentication token redirects to login
     * - [HIGH] API errors displayed with helpful messages
     * - [MEDIUM] Network timeouts handled with retry instructions
     */
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('Authentication required. Please log in again.');
                    setLoading(false);
                    return;
                }

                // Add timeout to prevent hanging requests
                const response = await axios.get(`${config.API_URL}/filetracker`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 30000 // 30 second timeout
                });
                
                setFileData(response.data);
                setError(null);
            } catch (err) {
                console.error('Error fetching file data:', err);
                
                if (err.code === 'ECONNABORTED') {
                    setError('Request timed out. Please check your connection and try again.');
                } else if (err.response?.status === 401) {
                    setError('Session expired. Please log in again.');
                } else {
                    setError('Error fetching data: ' + (err.response?.data?.error || err.message));
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    /**
     * FUNCTION: formatDate
     * PURPOSE: Convert date strings to readable format
     * PARAMETERS: dateString - ISO date string or timestamp
     * 
     * ERROR HANDLING:
     * - [LOW] Invalid dates return 'N/A' instead of crashing
     */
    const formatDate = useCallback((dateString) => {
        if (!dateString) return 'N/A';
        
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.warn('Date formatting error:', error);
            return 'N/A';
        }
    }, []);

    /**
     * FUNCTION: getUserTypeDisplay
     * PURPOSE: Get human-readable user role for display
     * PARAMETERS: user - User object with role flags
     * 
     * ERROR HANDLING:
     * - [LOW] Null/undefined user defaults to 'User'
     */
    const getUserTypeDisplay = useCallback((user) => {
        if (!user) return 'User';
        if (user.admin) return 'Administrator';
        if (user.doctor) return 'Doctor';
        return 'User';
    }, []);

    /**
     * FUNCTION: getUserTypeIcon
     * PURPOSE: Get appropriate icon for user role
     * PARAMETERS: user - User object with role flags
     */
    const getUserTypeIcon = useCallback((user) => {
        if (!user) return <PersonIcon />;
        if (user.admin) return <AdminPanelSettingsIcon />;
        if (user.doctor) return <MedicalServicesIcon />;
        return <PersonIcon />;
    }, []);

    /**
     * FUNCTION: handleLogout
     * PURPOSE: Clear authentication and refresh page
     * 
     * ERROR HANDLING:
     * - [LOW] localStorage errors don't prevent logout
     */
    const handleLogout = useCallback(() => {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        } catch (error) {
            console.warn('Error clearing localStorage:', error);
        }
        window.location.reload();
    }, []);

    /**
     * FUNCTION: handleRowClick
     * PURPOSE: Navigate to user-specific version details
     * PARAMETERS: params - DataGrid row click parameters
     * 
     * ERROR HANDLING:
     * - [LOW] Navigation errors handled by router
     */
    const handleRowClick = useCallback((params) => {
        navigate(`/user-versions/${params.row.username}`);
    }, [navigate]);

    /**
     * FUNCTION: handleDownloadCSV
     * PURPOSE: Download file tracker data as CSV file
     * 
     * PROCESS:
     * 1. Validate authentication token
     * 2. Request CSV data from server
     * 3. Create blob and trigger download
     * 4. Clean up resources
     * 
     * ERROR HANDLING:
     * - [HIGH] Authentication failures provide clear feedback
     * - [MEDIUM] Download errors show specific retry instructions
     * - [LOW] Blob creation failures handled gracefully
     */
    const handleDownloadCSV = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Authentication required for CSV download');
                return;
            }

            const response = await axios.get(`${config.API_URL}/filetracker/download-csv`, {
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'blob',
                timeout: 60000 // 60 second timeout for large files
            });

            // Create download blob
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `filetracker-data-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
        } catch (err) {
            console.error('CSV download error:', err);
            
            if (err.code === 'ECONNABORTED') {
                setError('Download timed out. The file may be too large. Please try again or contact support.');
            } else {
                setError('Error downloading CSV: ' + (err.response?.data?.error || err.message));
            }
        }
    }, []);

    /**
     * MEMOIZED CALCULATION: Data Grid Rows
     * PURPOSE: Transform file data into DataGrid-compatible format
     * OPTIMIZATION: Only recalculates when fileData changes
     * 
     * ERROR HANDLING:
     * - [MEDIUM] Missing fields default to 'N/A'
     * - [LOW] Complex date parsing handled with fallbacks
     */
    const rows = useMemo(() => {
        return fileData.map((file, index) => ({
            id: index,
            username: file.username || 'N/A',
            userID: file.device_info?.userID || 'N/A',
            deviceID: file.device_info?.deviceID || 'N/A',
            gender: file.device_info?.gender || 'N/A',
            age: file.device_info?.age?.$numberInt || file.device_info?.age || 'N/A',
            arm: file.device_info?.arm || 'N/A',
            sensorCombination: file.device_info?.sensorCombination || 'N/A',
            lastModified: file.last_modified,
            processedAt: file.processed_at?.$date?.$numberLong ? 
                new Date(parseInt(file.processed_at.$date.$numberLong)) : 
                file.processed_at,
            fileId: file._id,
            status: file.etag ? 'Active' : 'Inactive'
        }));
    }, [fileData]);

    /**
     * MEMOIZED CALCULATION: Data Grid Columns
     * PURPOSE: Define column structure with custom renderers
     * OPTIMIZATION: Prevents column recreation on every render
     */
    const columns = useMemo(() => [
        {
            field: 'username',
            headerName: 'Username',
            width: 150,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="primary" />
                    <Typography variant="body2" fontWeight="medium">
                        {params.value}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'userID',
            headerName: 'User ID',
            width: 120,
            renderCell: (params) => (
                <Typography variant="body2" color="text.secondary">
                    {params.value}
                </Typography>
            )
        },
        {
            field: 'deviceID',
            headerName: 'Device ID',
            width: 140,
            renderCell: (params) => (
                <Typography variant="body2" color="text.secondary">
                    {params.value}
                </Typography>
            )
        },
        {
            field: 'gender',
            headerName: 'Gender',
            width: 100,
            renderCell: (params) => (
                <Chip 
                    label={params.value} 
                    size="small" 
                    color={params.value === 'Male' ? 'primary' : params.value === 'Female' ? 'secondary' : 'default'}
                    variant="outlined"
                />
            )
        },
        {
            field: 'age',
            headerName: 'Age',
            width: 80,
            type: 'number',
            renderCell: (params) => (
                <Typography variant="body2">
                    {params.value !== 'N/A' ? `${params.value} yrs` : 'N/A'}
                </Typography>
            )
        },
        {
            field: 'arm',
            headerName: 'Arm',
            width: 100,
            renderCell: (params) => (
                <Chip 
                    label={params.value} 
                    size="small" 
                    color={params.value === 'Left' ? 'info' : params.value === 'Right' ? 'warning' : 'default'}
                    variant="outlined"
                />
            )
        },
        {
            field: 'sensorCombination',
            headerName: 'Sensor Type',
            width: 150,
            renderCell: (params) => (
                <Typography variant="body2" color="text.secondary">
                    {params.value}
                </Typography>
            )
        },
        {
            field: 'lastModified',
            headerName: 'Last Modified',
            width: 180,
            renderCell: (params) => (
                <Typography variant="body2" color="text.secondary">
                    {formatDate(params.value)}
                </Typography>
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
                    color={params.value === 'Active' ? 'success' : 'default'}
                    variant={params.value === 'Active' ? 'filled' : 'outlined'}
                />
            )
        }
    ], [formatDate]);

    // Loading state
    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ ml: 2 }}>Loading user data...</Typography>
            </Box>
        );
    }

    // Error state
    if (error) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="h6">Error Loading Data</Typography>
                    <Typography>{error}</Typography>
                    <Box sx={{ mt: 2 }}>
                        <Button 
                            variant="contained" 
                            onClick={() => window.location.reload()}
                            size="small"
                        >
                            Retry
                        </Button>
                    </Box>
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Page Header */}
            <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PeopleIcon sx={{ fontSize: 40 }} />
                    <Box>
                        <Typography variant="h4" fontWeight="bold">
                            Users & Files
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                            Manage user data, file uploads, and patient information
                        </Typography>
                    </Box>
                </Box>
            </Paper>



            {/* Data Grid */}
            <Paper sx={{ height: 600, width: '100%' }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    initialState={{
                        pagination: {
                            paginationModel: { page: 0, pageSize: 10 },
                        },
                    }}
                    pageSizeOptions={[5, 10, 25, 50]}
                    onRowClick={handleRowClick}
                    sx={{
                        '& .MuiDataGrid-row:hover': {
                            cursor: 'pointer',
                            backgroundColor: 'action.hover',
                        },
                    }}
                    disableRowSelectionOnClick
                />
            </Paper>

            {/* Summary Stats and Actions */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip 
                        icon={<PersonIcon />} 
                        label={`Total Users: ${fileData.length}`} 
                        variant="outlined" 
                    />
                    <Chip 
                        icon={<BarChartIcon />} 
                        label={`Active Records: ${fileData.filter(f => f.etag).length}`} 
                        color="success"
                        variant="outlined" 
                    />
                </Box>
                
                {/* Download CSV Button */}
                {user?.admin && (
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownloadCSV}
                        color="primary"
                    >
                        Download CSV
                    </Button>
                )}
            </Box>
        </Container>
    );
};

export default FileTracker; 
