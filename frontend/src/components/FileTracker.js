import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';

const FileTracker = () => {
    const [fileData, setFileData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('No authentication token found');
                    setLoading(false);
                    return;
                }

                const response = await axios.get('http://localhost:3000/filetracker', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setFileData(response.data);
                setLoading(false);
            } catch (err) {
                setError('Error fetching data: ' + err.message);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getUserTypeDisplay = (user) => {
        if (!user) return 'User';
        if (user.admin) return 'Administrator';
        if (user.doctor) return 'Doctor';
        return 'User';
    };

    const getUserTypeIcon = (user) => {
        if (!user) return <PersonIcon />;
        if (user.admin) return <AdminPanelSettingsIcon />;
        if (user.doctor) return <MedicalServicesIcon />;
        return <PersonIcon />;
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    };

    const handleRowClick = (params) => {
        navigate(`/user-versions/${params.row.username}`);
    };

    const handleDownloadCSV = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found');
                return;
            }

            const response = await axios.get('http://localhost:3000/filetracker/download-csv', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'filetracker-data.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError('Error downloading CSV: ' + err.message);
        }
    };

    // Prepare rows for DataGrid
    const rows = fileData.map((file, index) => ({
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

    // Define columns for DataGrid
    const columns = [
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
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            sortable: false,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AnalyticsIcon />}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/agp-report/${params.row.username}`);
                        }}
                        sx={{ minWidth: 'auto' }}
                    >
                        AGP
                    </Button>
                </Box>
            )
        }
    ];

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ ml: 2 }}>Loading user data...</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth={false} sx={{ mb: 4, px: 2 }}>
            <AppBar position="static" color="default" elevation={0} sx={{ mb: 3 }}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon />
                        User Management Dashboard
                    </Typography>
                    
                    {user && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {getUserTypeIcon(user)}
                                <Box>
                                    <Typography variant="body2" color="text.primary">
                                        {user.name || user.username}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {getUserTypeDisplay(user)}
                                    </Typography>
                                </Box>
                            </Box>
                            
                            {user.admin && (
                                <Button
                                    onClick={handleDownloadCSV}
                                    startIcon={<DownloadIcon />}
                                    variant="outlined"
                                    size="small"
                                >
                                    Export CSV
                                </Button>
                            )}
                            

                            
                            <IconButton onClick={handleLogout} color="inherit">
                                <LogoutIcon />
                            </IconButton>
                        </Box>
                    )}
                </Toolbar>
            </AppBar>

            <Paper sx={{ p: 3 }}>
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h5" color="primary">
                        User Data Overview
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {fileData.length} users • Click row for details • Use AGP button for glucose analysis
                    </Typography>
                </Box>

                <Box sx={{ height: 600, width: '100%' }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        pageSize={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        onRowClick={handleRowClick}
                        disableSelectionOnClick
                        sx={{
                            '& .MuiDataGrid-row:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 0.04)',
                                cursor: 'pointer'
                            },
                            '& .MuiDataGrid-cell:focus': {
                                outline: 'none'
                            },
                            '& .MuiDataGrid-row:focus': {
                                outline: 'none'
                            }
                        }}
                        components={{
                            NoRowsOverlay: () => (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                    <Typography variant="h6" color="text.secondary">
                                        No user data available
                                    </Typography>
                                </Box>
                            )
                        }}
                    />
                </Box>
            </Paper>
        </Container>
    );
};

export default FileTracker; 
