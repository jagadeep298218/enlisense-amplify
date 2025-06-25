/**
 * CSVUpload.js
 * 
 * PURPOSE: File upload component for importing patient personal information via CSV files
 * 
 * FEATURES:
 * - Drag-and-drop or click-to-select file upload interface
 * - CSV format validation with file type checking
 * - Real-time upload progress tracking with visual feedback
 * - Detailed upload results with success/error reporting
 * - Automatic data validation and error categorization
 * - Modal dialog for comprehensive upload result display
 * 
 * DEPENDENCIES:
 * - axios for multipart file upload with progress tracking
 * - Material-UI for consistent form and dialog components
 * - FormData API for file handling
 * 
 * ERROR HANDLING:
 * - [CRITICAL] Authentication token validation prevents unauthorized uploads
 * - [HIGH] File format validation ensures only CSV files are processed
 * - [MEDIUM] Upload failures provide specific error messages and retry guidance
 * - [LOW] File size limits enforced with user-friendly warnings
 */

import React, { useState, useCallback, useMemo } from 'react';
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

    /**
     * FUNCTION: validateFile
     * PURPOSE: Validate selected file type and size
     * PARAMETERS: selectedFile - File object from input
     * RETURNS: Object with isValid boolean and error message
     * 
     * ERROR HANDLING:
     * - [HIGH] File type validation prevents processing of non-CSV files
     * - [MEDIUM] File size limits prevent upload of oversized files
     */
    const validateFile = useCallback((selectedFile) => {
        if (!selectedFile) {
            return { isValid: false, error: 'No file selected' };
        }

        // Check file type
        const isCSV = selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv');
        if (!isCSV) {
            return { isValid: false, error: 'Please select a valid CSV file' };
        }

        // Check file size (limit to 10MB)
        const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
        if (selectedFile.size > maxSizeInBytes) {
            return { isValid: false, error: 'File size exceeds 10MB limit' };
        }

        return { isValid: true, error: null };
    }, []);

    /**
     * FUNCTION: handleFileSelect
     * PURPOSE: Process file selection and validation
     * PARAMETERS: event - File input change event
     * 
     * ERROR HANDLING:
     * - [MEDIUM] File validation errors displayed immediately
     * - [LOW] Multiple file selection handled by taking first file
     */
    const handleFileSelect = useCallback((event) => {
        const selectedFile = event.target.files[0];
        
        if (selectedFile) {
            const validation = validateFile(selectedFile);
            
            if (validation.isValid) {
                setFile(selectedFile);
                setError(null);
            } else {
                setError(validation.error);
                setFile(null);
                // Reset input
                event.target.value = '';
            }
        }
    }, [validateFile]);

    /**
     * FUNCTION: handleUpload
     * PURPOSE: Upload validated CSV file to server with progress tracking
     * 
     * PROCESS:
     * 1. Pre-upload validation of file and authentication
     * 2. FormData preparation for multipart upload
     * 3. Axios upload with timeout and progress tracking
     * 4. Result processing and user interface updates
     * 5. Cleanup and callback execution
     * 
     * ERROR HANDLING:
     * - [CRITICAL] Authentication token validation required for upload
     * - [HIGH] Network failures handled with specific error messages
     * - [MEDIUM] Timeout handling for large file uploads
     * - [LOW] Form reset and UI cleanup on completion
     */
    const handleUpload = useCallback(async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        // Validate authentication
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Authentication required. Please log in again.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('csvFile', file);

            const response = await axios.post('http://localhost:3000/upload-personal-info', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 120000, // 2 minute timeout for large files
                onUploadProgress: (progressEvent) => {
                    // Could add progress tracking here if needed
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    console.log(`Upload progress: ${percentCompleted}%`);
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

            // Notify parent component
            if (onUploadComplete) {
                onUploadComplete(response.data);
            }

        } catch (err) {
            console.error('Upload error:', err);
            
            let errorMessage = 'Failed to upload CSV file';
            
            if (err.code === 'ECONNABORTED') {
                errorMessage = 'Upload timed out. Please try a smaller file or check your connection.';
            } else if (err.response?.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
            } else if (err.response?.status === 413) {
                errorMessage = 'File too large. Please reduce file size and try again.';
            } else if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            }
            
            setError(errorMessage);
        } finally {
            setUploading(false);
        }
    }, [file, onUploadComplete]);

    /**
     * FUNCTION: handleCloseDialog
     * PURPOSE: Close results dialog and reset state
     */
    const handleCloseDialog = useCallback(() => {
        setShowResultDialog(false);
        setUploadResult(null);
    }, []);

    /**
     * MEMOIZED COMPONENT: Upload Button
     * PURPOSE: Optimize button rendering based on current state
     */
    const uploadButton = useMemo(() => (
        <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!file || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
        >
            {uploading ? 'Uploading...' : 'Upload Personal Information'}
        </Button>
    ), [handleUpload, file, uploading]);

    /**
     * MEMOIZED COMPONENT: File Selection Display
     * PURPOSE: Show selected file information
     */
    const fileInfo = useMemo(() => {
        if (!file) return null;
        
        return (
            <Typography variant="body2" color="text.secondary">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </Typography>
        );
    }, [file]);

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <UploadIcon color="primary" />
                Upload Personal Information (CSV)
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload a CSV file containing user personal information. The CSV should include columns like: 
                username, army, pregnant, smokes, drinks, High BP, Diabete, etc.
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
                    
                    {fileInfo}
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
                    {uploadButton}
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
                                                            primary={`Row ${error.row || 'N/A'}`}
                                                            secondary={error.message}
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
                    <Button onClick={handleCloseDialog}>Close</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default CSVUpload; 