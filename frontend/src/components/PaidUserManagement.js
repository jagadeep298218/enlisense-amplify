/**
 * PaidUserManagement.js
 * 
 * PURPOSE: Administrative interface for managing paid user status
 * 
 * FEATURES:
 * - List all users with their paid status
 * - Toggle paid/unpaid status for users
 * - Search and filter functionality
 * - Update history tracking
 * 
 * DEPENDENCIES:
 * - Material-UI for UI components
 * - API integration for user management
 * 
 * ERROR HANDLING:
 * - [CRITICAL] API failures with user feedback
 * - [MEDIUM] Network errors with retry options
 * - [LOW] Form validation errors
 */

import React, { useState, useEffect, useCallback } from 'react';
import config from '../config';
import {
    Container,
    Typography,
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Switch,
    Chip,
    Alert,
    CircularProgress,
    TextField,
    InputAdornment,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel
} from '@mui/material';
import {
    Search as SearchIcon,
    ArrowBack as ArrowBackIcon,
    Refresh as RefreshIcon,
    Person as PersonIcon,
    AccountBalance as PaidIcon,
    Block as UnpaidIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const PaidUserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [updating, setUpdating] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, user: null, action: null });

    /**
     * FUNCTION: fetchUsers
     * PURPOSE: Fetch all users with their paid status from the API
     */
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${config.API_URL}/admin/paid-users`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Admin access required');
                } else if (response.status === 401) {
                    throw new Error('Authentication expired');
                } else {
                    throw new Error(`Failed to fetch users (${response.status})`);
                }
            }

            const data = await response.json();
            setUsers(data.users || []);

        } catch (error) {
            console.error('Error fetching users:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * FUNCTION: handlePaidStatusToggle
     * PURPOSE: Update a user's paid status
     */
    const handlePaidStatusToggle = async (username, currentStatus) => {
        const newStatus = !currentStatus;
        setConfirmDialog({
            open: true,
            user: username,
            action: newStatus ? 'grant' : 'revoke'
        });
    };

    /**
     * FUNCTION: confirmStatusChange
     * PURPOSE: Execute the paid status change after confirmation
     */
    const confirmStatusChange = async () => {
        const { user: username, action } = confirmDialog;
        const newStatus = action === 'grant';

        try {
            setUpdating(username);
            setError(null);

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${config.API_URL}/admin/paid-users/${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ paid_user: newStatus })
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Admin access required');
                } else if (response.status === 404) {
                    throw new Error('User not found');
                } else {
                    throw new Error(`Failed to update user status (${response.status})`);
                }
            }

            // Update local state
            setUsers(prev => prev.map(user => 
                user.username === username 
                    ? { ...user, paid_user: newStatus }
                    : user
            ));

            setConfirmDialog({ open: false, user: null, action: null });

        } catch (error) {
            console.error('Error updating paid status:', error);
            setError(error.message);
        } finally {
            setUpdating(null);
        }
    };

    /**
     * FUNCTION: filteredUsers
     * PURPOSE: Filter users based on search term
     */
    const filteredUsers = users.filter(user => 
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const paidUsersCount = users.filter(user => user.paid_user).length;
    const totalUsersCount = users.length;

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                    <CircularProgress size={60} />
                    <Typography variant="h6" sx={{ ml: 2 }}>Loading users...</Typography>
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Page Header */}
            <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PaidIcon sx={{ fontSize: 40 }} />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h4" fontWeight="bold">
                            Paid User Management
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                            Manage user payment status and access permissions
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }} className="pdf-hide">
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate('/')}
                            variant="outlined"
                            sx={{ 
                                borderColor: 'rgba(255,255,255,0.3)', 
                                color: 'white',
                                '&:hover': {
                                    borderColor: 'rgba(255,255,255,0.5)',
                                    bgcolor: 'rgba(255,255,255,0.1)'
                                }
                            }}
                        >
                            Back
                        </Button>
                        <Button
                            startIcon={<RefreshIcon />}
                            onClick={fetchUsers}
                            variant="outlined"
                            sx={{ 
                                borderColor: 'rgba(255,255,255,0.3)', 
                                color: 'white',
                                '&:hover': {
                                    borderColor: 'rgba(255,255,255,0.5)',
                                    bgcolor: 'rgba(255,255,255,0.1)'
                                }
                            }}
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Search and Stats */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    sx={{ minWidth: 300 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
                
                <Chip 
                    icon={<PaidIcon />} 
                    label={`Paid Users: ${paidUsersCount}`} 
                    color="success"
                    variant="outlined" 
                />
                <Chip 
                    icon={<PersonIcon />} 
                    label={`Total Users: ${totalUsersCount}`} 
                    variant="outlined" 
                />
            </Box>

            {/* Users Table */}
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Username</strong></TableCell>
                                <TableCell><strong>Name</strong></TableCell>
                                <TableCell><strong>User Type</strong></TableCell>
                                <TableCell><strong>Paid Status</strong></TableCell>
                                <TableCell><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.username} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="medium">
                                            {user.username}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {user.name || 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            {user.admin && <Chip label="Admin" size="small" color="error" />}
                                            {user.doctor && <Chip label="Doctor" size="small" color="primary" />}
                                            {user.patient && <Chip label="Patient" size="small" color="info" />}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            icon={user.paid_user ? <PaidIcon /> : <UnpaidIcon />}
                                            label={user.paid_user ? 'Paid' : 'Free'}
                                            color={user.paid_user ? 'success' : 'default'}
                                            variant={user.paid_user ? 'filled' : 'outlined'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={user.paid_user || false}
                                                    onChange={() => handlePaidStatusToggle(user.username, user.paid_user)}
                                                    disabled={updating === user.username}
                                                    color="success"
                                                />
                                            }
                                            label={user.paid_user ? 'Paid' : 'Free'}
                                            labelPlacement="start"
                                            sx={{ margin: 0 }}
                                        />
                                        {updating === user.username && (
                                            <CircularProgress size={16} sx={{ ml: 1 }} />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {filteredUsers.length === 0 && !loading && (
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <Typography variant="h6" color="text.secondary">
                        {searchTerm ? 'No users found matching your search' : 'No users found'}
                    </Typography>
                </Box>
            )}

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog({ open: false, user: null, action: null })}
            >
                <DialogTitle>
                    Confirm Status Change
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to {confirmDialog.action} paid access for user{' '}
                        <strong>{confirmDialog.user}</strong>?
                    </Typography>
                    {confirmDialog.action === 'grant' && (
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                            This user will be able to download AGP reports as PDF and CSV.
                        </Typography>
                    )}
                    {confirmDialog.action === 'revoke' && (
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                            This user will no longer be able to download AGP reports.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => setConfirmDialog({ open: false, user: null, action: null })}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={confirmStatusChange}
                        variant="contained"
                        color={confirmDialog.action === 'grant' ? 'success' : 'error'}
                    >
                        {confirmDialog.action === 'grant' ? 'Grant Access' : 'Revoke Access'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default PaidUserManagement; 