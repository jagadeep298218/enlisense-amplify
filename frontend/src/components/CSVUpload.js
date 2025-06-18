import React, { useState } from 'react';
import {
    Box,
    Button,
    Paper,
    Typography,
    Alert,
    CircularProgress,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    Divider
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon
} from '@mui/icons-material';
import axios from 'axios';

const CSVUpload = ({ onUploadComplete }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [showResultDialog, setShowResultDialog] = useState(false);
    const [error, setError] = useState(null);

    const handleFileSelect = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
                setFile(selectedFile);
                setError(null);
            } else {
                setError('Please select a valid CSV file');
                setFile(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('csvFile', file);

            const token = localStorage.getItem('token');
            const response = await axios.post('http://localhost:3000/upload-personal-info', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setUploadResult(response.data);
            setShowResultDialog(true);
            setFile(null);
            
            // Reset file input
            const fileInput = document.getElementById('csv-file-input');
            if (fileInput) {
                fileInput.value = '';
            }

            if (onUploadComplete) {
                onUploadComplete(response.data);
            }

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Failed to upload CSV file');
        } finally {
            setUploading(false);
        }
    };

    const handleCloseDialog = () => {
        setShowResultDialog(false);
        setUploadResult(null);
    };

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <UploadIcon color="primary" />
                Upload Personal Information (CSV)
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload a CSV file containing user personal information. The CSV should include columns like: username, army, pregnant, smokes, drinks, High BP, Diabete, etc.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        component="label"
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        disabled={uploading}
                    >
                        Choose CSV File
                        <input
                            id="csv-file-input"
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </Button>
                    
                    {file && (
                        <Typography variant="body2" color="text.secondary">
                            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </Typography>
                    )}
                </Box>

                {uploading && (
                    <Box sx={{ width: '100%' }}>
                        <LinearProgress />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Processing CSV file...
                        </Typography>
                    </Box>
                )}

                <Box>
                    <Button
                        onClick={handleUpload}
                        variant="contained"
                        disabled={!file || uploading}
                        startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
                    >
                        {uploading ? 'Uploading...' : 'Upload Personal Information'}
                    </Button>
                </Box>
            </Box>

            {/* Results Dialog */}
            <Dialog open={showResultDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {uploadResult?.errorCount === 0 ? (
                        <SuccessIcon color="success" />
                    ) : (
                        <ErrorIcon color="warning" />
                    )}
                    Upload Results
                </DialogTitle>
                <DialogContent>
                    {uploadResult && (
                        <Box>
                            <Alert 
                                severity={uploadResult.errorCount === 0 ? 'success' : 'warning'} 
                                sx={{ mb: 2 }}
                            >
                                {uploadResult.message}
                            </Alert>

                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body1">
                                    <strong>Total Rows:</strong> {uploadResult.totalRows}
                                </Typography>
                                <Typography variant="body1" color="success.main">
                                    <strong>Successfully Processed:</strong> {uploadResult.successCount}
                                </Typography>
                                {uploadResult.errorCount > 0 && (
                                    <Typography variant="body1" color="error.main">
                                        <strong>Errors:</strong> {uploadResult.errorCount}
                                    </Typography>
                                )}
                            </Box>

                            {uploadResult.errors && uploadResult.errors.length > 0 && (
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        Error Details:
                                    </Typography>
                                    <Paper sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                                        <List dense>
                                            {uploadResult.errors.map((error, index) => (
                                                <React.Fragment key={index}>
                                                    <ListItem>
                                                        <ListItemText 
                                                            primary={error}
                                                            primaryTypographyProps={{ 
                                                                variant: 'body2',
                                                                color: 'error'
                                                            }}
                                                        />
                                                    </ListItem>
                                                    {index < uploadResult.errors.length - 1 && <Divider />}
                                                </React.Fragment>
                                            ))}
                                        </List>
                                    </Paper>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} variant="contained">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default CSVUpload; 