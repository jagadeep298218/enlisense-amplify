import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Typography, 
    Box, 
    Alert, 
    CircularProgress,
    Paper
} from '@mui/material';
import { Compare as CompareIcon } from '@mui/icons-material';
import PatientComparison from './PatientComparison';
import config from '../config';

const CompareAGP = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${config.API_URL}/filetracker`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch patient data');
            }

            const data = await response.json();
            setPatients(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching patients:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Page Header */}
            <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CompareIcon sx={{ fontSize: 40 }} />
                    <Box>
                        <Typography variant="h4" fontWeight="bold">
                            Compare AGP Reports
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                            Compare Ambulatory Glucose Profile reports between two patients
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Error Display */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Error loading patient data: {error}
                </Alert>
            )}

            {/* Patient Comparison Component */}
            <PatientComparison patients={patients} />

            {/* Additional Information */}
            <Paper sx={{ p: 3, mt: 4, bgcolor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom>
                    About AGP Comparison
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    The AGP comparison tool allows you to analyze glucose or cortisol patterns between two patients side by side. 
                    Select two different patients and choose the biomarker type to generate a comprehensive comparison report 
                    that includes time-in-range statistics, daily patterns, and variability metrics.
                </Typography>
            </Paper>    
        </Container>
    );
};

export default CompareAGP; 