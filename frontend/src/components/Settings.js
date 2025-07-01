import React from 'react';
import { Box, Typography, Paper, Container } from '@mui/material';
import { UploadFile as UploadIcon } from '@mui/icons-material';
import CSVUpload from './CSVUpload';

const Settings = () => {
    const handleUploadComplete = (result) => {
        console.log('Upload completed:', result);
        // You can add additional logic here if needed
        // For now, the CSVUpload component handles the result display
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Page Header */}
            <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <UploadIcon sx={{ fontSize: 40 }} />
                    <Box>
                        <Typography variant="h4" fontWeight="bold">
                            Upload Personal Information
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                            Upload and manage personal information data through CSV files
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            <CSVUpload onUploadComplete={handleUploadComplete} />

            {/* Additional upload-related functionality can be added here */}
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                    CSV Format Guidelines
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Your CSV file should include the following columns for personal information:
                </Typography>
                <Box component="ul" sx={{ pl: 3, m: 0 }}>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        <strong>username:</strong> Unique identifier for the user
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        <strong>army:</strong> Military status (true/false)
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        <strong>pregnant:</strong> Pregnancy status (true/false)
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        <strong>smokes:</strong> Smoking status (true/false)
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        <strong>drinks:</strong> Drinking status (true/false)
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        <strong>High BP:</strong> High blood pressure status (true/false)
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                        <strong>Diabete:</strong> Diabetes status (true/false)
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    <strong>Note:</strong> Make sure your CSV file has headers and uses comma separation. 
                    Boolean values should be represented as true/false or 1/0.
                </Typography>
            </Paper>
        </Container>
    );
};

export default Settings; 